# Perfetto - System profiling, app tracing and trace analysis

Perfetto is a production-grade open-source stack for performance
instrumentation and trace analysis. It offers services and libraries and for
recording system-level and app-level traces, native + java heap profiling, a
library for analyzing traces using SQL and a web-based UI to visualize and
explore multi-GB traces.

See https://perfetto.dev/docs or the /docs/ directory for documentation.

# Fork

Some ~stupid~ things that I've added (without fully tested, without any
testcase, yes, without warranty, you've been warned):

* Add `kernel_stack` event, this is a trigger that can be used with ftrace
  events, maybe useful when debugging some functionality issues (may have
  no help with performance-related issues). Now the stack is available in
  processes' `Callstack` section.
* Support the `riscv64` architecture, only tested with Lichee Pi 4A.

There's more things to be done:

* The code is extremely simple & naive, without any abstractions, and is not
  ready for production use, maybe there's a HUGE refactor then. Like some kind
  of proof-of-concept.
* Missing unittest, valgrind/asan test, etc.
* The perf sample section seems not combining well with ftrace event, if you
  want to view the stack of a ftrace event, you shall first locate the process
  first... So, may have a try to improve the UI?
* Fully UNTESTED, things might go wrong if you enable both `fstacktrace` and
  `sampling_stack`. And only `linux.ftrace` + `linux.perf` is working.
