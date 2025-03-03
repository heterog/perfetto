/*
 * Copyright (C) 2024 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include "src/trace_processor/importers/common/virtual_memory_mapping.h"

#include <cstddef>
#include <cstdint>
#include <memory>
#include <optional>
#include <string>
#include <utility>

#include "perfetto/ext/base/string_view.h"
#include "src/trace_processor/importers/common/address_range.h"
#include "src/trace_processor/importers/common/mapping_tracker.h"
#include "src/trace_processor/importers/common/stack_profile_tracker.h"
#include "src/trace_processor/storage/trace_storage.h"
#include "src/trace_processor/tables/profiler_tables_py.h"
#include "src/trace_processor/types/trace_processor_context.h"
#include "src/trace_processor/util/build_id.h"

namespace perfetto {
namespace trace_processor {
namespace {

MappingId CreateMapping(TraceProcessorContext* context,
                        const CreateMappingParams& params) {
  StringId build_id = context->storage->InternString(base::StringView(
      params.build_id ? params.build_id->ToHex() : std::string()));
  MappingId mapping_id =
      context->storage->mutable_stack_profile_mapping_table()
          ->Insert(
              {build_id, static_cast<int64_t>(params.exact_offset),
               static_cast<int64_t>(params.start_offset),
               static_cast<int64_t>(params.memory_range.start()),
               static_cast<int64_t>(params.memory_range.end()),
               static_cast<int64_t>(params.load_bias),
               context->storage->InternString(base::StringView(params.name))})
          .id;

  return mapping_id;
}

}  // namespace

VirtualMemoryMapping::VirtualMemoryMapping(TraceProcessorContext* context,
                                           CreateMappingParams params)
    : context_(context),
      mapping_id_(CreateMapping(context, params)),
      memory_range_(params.memory_range),
      offset_(params.exact_offset),
      load_bias_(params.load_bias),
      name_(std::move(params.name)),
      build_id_(std::move(params.build_id)) {}

VirtualMemoryMapping::~VirtualMemoryMapping() = default;

KernelMemoryMapping::KernelMemoryMapping(TraceProcessorContext* context,
                                         CreateMappingParams params)
    : VirtualMemoryMapping(context, std::move(params)) {}

KernelMemoryMapping::~KernelMemoryMapping() = default;

UserMemoryMapping::UserMemoryMapping(TraceProcessorContext* context,
                                     UniquePid upid,
                                     CreateMappingParams params)
    : VirtualMemoryMapping(context, std::move(params)), upid_(upid) {}

UserMemoryMapping::~UserMemoryMapping() = default;

FrameId VirtualMemoryMapping::InternFrame(uint64_t rel_pc,
                                          base::StringView function_name) {
  auto [frame_id, was_inserted] =
      jit_delegate_ ? jit_delegate_->InternFrame(this, rel_pc, function_name)
                    : InternFrameImpl(rel_pc, function_name);
  if (was_inserted) {
    frames_by_rel_pc_[rel_pc].push_back(frame_id);
    context_->stack_profile_tracker->OnFrameCreated(frame_id);
  }
  return frame_id;
}

std::vector<FrameId> VirtualMemoryMapping::FindFrameIds(uint64_t rel_pc) const {
  if (auto* res = frames_by_rel_pc_.Find(rel_pc); res != nullptr) {
    return *res;
  }
  return {};
}

std::pair<FrameId, bool> VirtualMemoryMapping::InternFrameImpl(
    uint64_t rel_pc,
    base::StringView function_name) {
  const FrameKey frame_key{rel_pc,
                           context_->storage->InternString(function_name)};
  if (FrameId* id = interned_frames_.Find(frame_key); id) {
    return {*id, false};
  }

  const FrameId frame_id =
      context_->storage->mutable_stack_profile_frame_table()
          ->Insert(
              {frame_key.name_id, mapping_id_, static_cast<int64_t>(rel_pc)})
          .id;
  interned_frames_.Insert(frame_key, frame_id);

  return {frame_id, true};
}

}  // namespace trace_processor
}  // namespace perfetto
