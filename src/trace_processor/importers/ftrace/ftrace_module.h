/*
 * Copyright (C) 2019 The Android Open Source Project
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

#ifndef SRC_TRACE_PROCESSOR_IMPORTERS_FTRACE_FTRACE_MODULE_H_
#define SRC_TRACE_PROCESSOR_IMPORTERS_FTRACE_FTRACE_MODULE_H_

#include "src/trace_processor/importers/common/parser_types.h"
#include "src/trace_processor/importers/common/trace_parser.h"
#include "src/trace_processor/importers/proto/proto_importer_module.h"

namespace perfetto {
namespace trace_processor {

class FtraceModule : public ProtoImporterModule {
 public:
  virtual void ParseFtraceEventData(uint32_t cpu,
                                    int64_t ts,
                                    const TracePacketData& data);

  virtual void ParseInlineSchedSwitch(uint32_t cpu,
                                      int64_t ts,
                                      const InlineSchedSwitch& data);

  virtual void ParseInlineSchedWaking(uint32_t cpu,
                                      int64_t ts,
                                      const InlineSchedWaking& data);

  // TODO: "uint32_t id" -> "RawId id"
  void SetLastFtraceEventId(uint32_t cpu, uint32_t id) {
    last_ftrace_event_ids_.resize(cpu + 1, static_cast<uint32_t>(-1));
    last_ftrace_event_ids_[cpu] = id;
  }

  std::optional<uint32_t> GetLastFtraceEventId(uint32_t cpu) {
    if (cpu >= last_ftrace_event_ids_.size()) {
      return std::nullopt;
    }

    const uint32_t id = last_ftrace_event_ids_[cpu];
    if (id == static_cast<uint32_t>(-1)) {
      return std::nullopt;
    }
    return id;
  }

 private:
  // TODO: Not a good example for abstracting, but have no other idea where
  // to place the ftrace related internal fields? Maybe the `context_->storage`?
  // TODO: Use `base::SmallVector` for (maybe) better performance?
  std::vector<uint32_t> last_ftrace_event_ids_;
};

}  // namespace trace_processor
}  // namespace perfetto

#endif  // SRC_TRACE_PROCESSOR_IMPORTERS_FTRACE_FTRACE_MODULE_H_
