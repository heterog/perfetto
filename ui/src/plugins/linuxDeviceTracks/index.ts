// Copyright (C) 2024 The Android Open Source Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {
  NUM,
  Plugin,
  PluginContext,
  PluginContextTrace,
  PluginDescriptor,
  STR_NULL,
} from '../../public';
import {ASYNC_SLICE_TRACK_KIND} from '../../tracks/async_slices';
import {AsyncSliceTrackV2} from '../../tracks/async_slices/async_slice_track_v2';

// This plugin renders visualizations of runtime power state transitions for
// Linux kernel devices (devices managed by Linux drivers).
class linuxDevices implements Plugin {
  onActivate(_: PluginContext): void {
  }

  async onTraceLoad(ctx: PluginContextTrace): Promise<void> {
    const result = await ctx.engine.query(`
      with
        slices_tracks as materialized (
          select distinct track_id
          from slice
        ),
        tracks as (
          select
            linux_device_track.id as track_id,
            linux_device_track.name
          from linux_device_track
          join slices_tracks on
	    slices_tracks.track_id = linux_device_track.id
        )
      select
        t.name,
        t.track_id as trackId
      from tracks as t
      order by t.name;
    `);

    const it = result.iter({
      name: STR_NULL,
      trackId: NUM,
    });

    for (; it.valid(); it.next()) {
      const trackId = it.trackId;
      const name = it.name ?? `${trackId}`;

      ctx.registerStaticTrack({
        uri: `linuxDeviceTracks#${name}`,
        displayName: name,
        trackIds: [trackId],
        kind: ASYNC_SLICE_TRACK_KIND,
        trackFactory: ({trackKey}) => {
          return new AsyncSliceTrackV2(
            {
              engine: ctx.engine,
              trackKey,
            },
            0,
            [trackId],
          );
        },
        groupName: `Linux Kernel Devices`,
      });
    }
  }
}

export const plugin: PluginDescriptor = {
  pluginId: 'linuxDeviceTracks',
  plugin: linuxDevices,
};
