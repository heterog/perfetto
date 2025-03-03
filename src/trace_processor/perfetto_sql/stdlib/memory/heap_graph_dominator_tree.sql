--
-- Copyright 2024 The Android Open Source Project
--
-- Licensed under the Apache License, Version 2.0 (the "License");
-- you may not use this file except in compliance with the License.
-- You may obtain a copy of the License at
--
--     https://www.apache.org/licenses/LICENSE-2.0
--
-- Unless required by applicable law or agreed to in writing, software
-- distributed under the License is distributed on an "AS IS" BASIS,
-- WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-- See the License for the specific language governing permissions and
-- limitations under the License.

INCLUDE PERFETTO MODULE graphs.dominator_tree;

-- Excluding following types from the graph as they share objects' ownership
-- with their real (more interesting) owners and will mask their idom to be the
-- imaginary "root".
CREATE PERFETTO TABLE _excluded_type_ids AS
WITH RECURSIVE class_visitor(type_id) AS (
  SELECT id AS type_id
  FROM heap_graph_class
  WHERE name IN (
    'java.lang.ref.PhantomReference',
    'java.lang.ref.FinalizerReference'
  )
  UNION ALL
  SELECT child.id AS type_id
  FROM heap_graph_class child
  JOIN class_visitor parent ON parent.type_id = child.superclass_id
)
SELECT * FROM class_visitor;

CREATE PERFETTO VIEW _dominator_compatible_heap_graph AS
SELECT
  ref.owner_id AS source_node_id,
  ref.owned_id AS dest_node_id
FROM heap_graph_reference ref
JOIN heap_graph_object source_node ON ref.owner_id = source_node.id
WHERE source_node.reachable AND source_node.type_id NOT IN _excluded_type_ids
  AND ref.owned_id IS NOT NULL
UNION ALL
-- Since a Java heap graph is a "forest" structure, we need to add a imaginary
-- "root" node which connects all the roots of the forest into a single
-- connected component.
SELECT
  (SELECT max(id) + 1 FROM heap_graph_object) as source_node_id,
  id AS dest_node_id
FROM heap_graph_object
WHERE root_type IS NOT NULL;

CREATE PERFETTO TABLE _heap_graph_dominator_tree AS
SELECT
  node_id AS id,
  dominator_node_id AS idom_id
FROM graph_dominator_tree!(
  _dominator_compatible_heap_graph,
  (SELECT max(id) + 1 FROM heap_graph_object)
)
-- Excluding the imaginary root.
WHERE dominator_node_id IS NOT NULL
-- Ordering by idom_id so queries below are faster when joining on idom_id.
-- TODO(lalitm): support create index for Perfetto tables.
ORDER BY idom_id;

-- A performance note: we need 3 memoize functions because EXPERIMENTAL_MEMOIZE
-- limits the function to return only 1 int.
-- This means the exact same "memoized dfs pass" on the tree is done 3 times, so
-- it takes 3x the time taken by only doing 1 pass. Doing only 1 pass would be
-- possible if EXPERIMENTAL_MEMOIZE could return more than 1 int.

CREATE PERFETTO FUNCTION _subtree_obj_count(id INT)
RETURNS INT AS
SELECT 1 + IFNULL((
  SELECT
    SUM(_subtree_obj_count(child.id))
  FROM _heap_graph_dominator_tree child
  WHERE child.idom_id = $id
), 0);
SELECT EXPERIMENTAL_MEMOIZE('_subtree_obj_count');

CREATE PERFETTO FUNCTION _subtree_size_bytes(id INT)
RETURNS INT AS
SELECT (
  SELECT self_size
  FROM heap_graph_object
  WHERE heap_graph_object.id = $id
) +
IFNULL((
  SELECT
    SUM(_subtree_size_bytes(child.id))
  FROM _heap_graph_dominator_tree child
  WHERE child.idom_id = $id
), 0);
SELECT EXPERIMENTAL_MEMOIZE('_subtree_size_bytes');

CREATE PERFETTO FUNCTION _subtree_native_size_bytes(id INT)
RETURNS INT AS
SELECT (
  SELECT native_size
  FROM heap_graph_object
  WHERE heap_graph_object.id = $id
) +
IFNULL((
  SELECT
    SUM(_subtree_native_size_bytes(child.id))
  FROM _heap_graph_dominator_tree child
  WHERE child.idom_id = $id
), 0);
SELECT EXPERIMENTAL_MEMOIZE('_subtree_native_size_bytes');

-- All reachable heap graph objects, their immediate dominators and summary of
-- their dominated sets.
-- The heap graph dominator tree is calculated by stdlib graphs.dominator_tree.
-- Each reachable object is a node in the dominator tree, their immediate
-- dominator is their parent node in the tree, and their dominated set is all
-- their descendants in the tree. All size information come from the
-- heap_graph_object prelude table.
CREATE PERFETTO TABLE memory_heap_graph_dominator_tree (
  -- Heap graph object id.
  id INT,
  -- Immediate dominator object id of the object.
  idom_id INT,
  -- Count of all objects dominated by this object, self inclusive.
  dominated_obj_count INT,
  -- Total self_size of all objects dominated by this object, self inclusive.
  dominated_size_bytes INT,
  -- Total native_size of all objects dominated by this object, self inclusive.
  dominated_native_size_bytes INT
) AS
SELECT
  id,
  idom_id,
  _subtree_obj_count(id) AS dominated_obj_count,
  _subtree_size_bytes(id) AS dominated_size_bytes,
  _subtree_native_size_bytes(id) AS dominated_native_size_bytes
FROM _heap_graph_dominator_tree;
