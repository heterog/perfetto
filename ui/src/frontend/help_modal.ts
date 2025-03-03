
// Copyright (C) 2019 The Android Open Source Project
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

import m from 'mithril';

import {raf} from '../core/raf_scheduler';
import {showModal} from '../widgets/modal';
import {Spinner} from '../widgets/spinner';

import {globals} from './globals';
import {
  KeyboardLayoutMap,
  nativeKeyboardLayoutMap,
  NotSupportedError,
} from './keyboard_layout_map';
import {KeyMapping} from './pan_and_zoom_handler';

export function toggleHelp() {
  globals.logging.logEvent('User Actions', 'Show help');
  showHelp();
}

function keycap(glyph: m.Children): m.Children {
  return m('.keycap', glyph);
}

// A fallback keyboard map based on the QWERTY keymap. Converts keyboard event
// codes to their associated glyphs on an English QWERTY keyboard.
class EnglishQwertyKeyboardLayoutMap implements KeyboardLayoutMap {
  get(code: string): string {
    // Converts 'KeyX' -> 'x'
    return code.replace(/^Key([A-Z])$/, '$1').toLowerCase();
  }
}

class KeyMappingsHelp implements m.ClassComponent {
  private keyMap?: KeyboardLayoutMap;

  oninit() {
    nativeKeyboardLayoutMap()
      .then((keyMap: KeyboardLayoutMap) => {
        this.keyMap = keyMap;
        raf.scheduleFullRedraw();
      })
      .catch((e) => {
        if (e instanceof NotSupportedError ||
              e.toString().includes('SecurityError')) {
          // Keyboard layout is unavailable. Since showing the keyboard
          // mappings correct for the user's keyboard layout is a nice-to-
          // have, and users with non-QWERTY layouts are usually aware of the
          // fact that the are using non-QWERTY layouts, we resort to showing
          // English QWERTY mappings as a best-effort approach.
          // The alternative would be to show key mappings for all keyboard
          // layouts which is not feasible.
          this.keyMap = new EnglishQwertyKeyboardLayoutMap();
          raf.scheduleFullRedraw();
        } else {
          // Something unexpected happened. Either the browser doesn't conform
          // to the keyboard API spec, or the keyboard API spec has changed!
          throw e;
        }
      });
  }

  view(_: m.Vnode): m.Children {
    const ctrlOrCmd =
        window.navigator.platform.indexOf('Mac') !== -1 ? 'Cmd' : 'Ctrl';

    const queryPageInstructions = globals.hideSidebar ? [] : [
      m('h2', 'Making SQL queries from the query page'),
      m('table',
        m('tr',
          m('td', keycap('Ctrl'), ' + ', keycap('Enter')),
          m('td', 'Execute query')),
        m('tr',
          m('td', keycap('Ctrl'), ' + ', keycap('Enter'), ' (with selection)'),
          m('td', 'Execute selection'))),
    ];

    const sidebarInstructions = globals.hideSidebar ?
      [] :
      [m('tr',
        m('td', keycap(ctrlOrCmd), ' + ', keycap('b')),
        m('td', 'Toggle display of sidebar'))];

    return m(
      '.help',
      m('h2', 'Navigation'),
      m(
        'table',
        m(
          'tr',
          m('td',
            this.codeToKeycap(KeyMapping.KEY_ZOOM_IN),
            '/',
            this.codeToKeycap(KeyMapping.KEY_ZOOM_OUT)),
          m('td', 'Zoom in/out'),
        ),
        m(
          'tr',
          m('td',
            this.codeToKeycap(KeyMapping.KEY_PAN_LEFT),
            '/',
            this.codeToKeycap(KeyMapping.KEY_PAN_RIGHT)),
          m('td', 'Pan left/right'),
        ),
      ),
      m('h2', 'Mouse Controls'),
      m('table',
        m('tr', m('td', 'Click'), m('td', 'Select event')),
        m('tr', m('td', 'Ctrl + Scroll wheel'), m('td', 'Zoom in/out')),
        m('tr', m('td', 'Click + Drag'), m('td', 'Select area')),
        m('tr', m('td', 'Shift + Click + Drag'), m('td', 'Pan left/right'))),
      m('h2', 'Running commands from the viewer page'),
      m('table',
        m('tr',
          m('td', keycap('>'), ' in the (empty) search box'),
          m('td', 'Switch to command mode'))),
      m('h2', 'Making SQL queries from the viewer page'),
      m('table',
        m('tr',
          m('td', keycap(':'), ' in the (empty) search box'),
          m('td', 'Switch to query mode')),
        m('tr', m('td', keycap('Enter')), m('td', 'Execute query')),
        m('tr',
          m('td', keycap('Ctrl'), ' + ', keycap('Enter')),
          m('td',
            'Execute query and pin output ' +
                  '(output will not be replaced by regular query input)'))),
      ...queryPageInstructions,
      m('h2', 'Other'),
      m(
        'table',
        m('tr',
          m('td', keycap('f'), ' (with event selected)'),
          m('td', 'Scroll + zoom to current selection')),
        m('tr',
          m('td', keycap('['), '/', keycap(']'), ' (with event selected)'),
          m('td',
            'Select next/previous slice that is connected by a flow.',
            m('br'),
            'If there are multiple flows,' +
                    'the one that is in focus (bold) is selected')),
        m('tr',
          m('td',
            keycap(ctrlOrCmd),
            ' + ',
            keycap('['),
            '/',
            keycap(']'),
            ' (with event selected)'),
          m('td', 'Switch focus to another flow')),
        m('tr',
          m('td', keycap('m'), ' (with event or area selected)'),
          m('td', 'Mark the area (temporarily)')),
        m('tr',
          m('td',
            keycap('Shift'),
            ' + ',
            keycap('m'),
            ' (with event or area selected)'),
          m('td', 'Mark the area (persistently)')),
        m('tr',
          m('td', keycap(ctrlOrCmd), ' + ', keycap('a')),
          m('td', 'Select all')),
        m('tr',
          m('td',
            keycap(ctrlOrCmd),
            ' + ',
            keycap('Shift'),
            ' + ',
            keycap('p')),
          m('td', 'Open command palette')),
        m('tr',
          m('td', keycap(ctrlOrCmd), ' + ', keycap('o')),
          m('td', 'Run query')),
        m('tr',
          m('td', keycap(ctrlOrCmd), ' + ', keycap('s')),
          m('td', 'Search')),
        ...sidebarInstructions,
        m('tr', m('td', keycap('?')), m('td', 'Show help')),
      ));
  }

  private codeToKeycap(code: string): m.Children {
    if (this.keyMap) {
      return keycap(this.keyMap.get(code));
    } else {
      return keycap(m(Spinner));
    }
  }
}

function showHelp() {
  showModal({
    title: 'Perfetto Help',
    content: () => m(KeyMappingsHelp),
    buttons: [],
  });
}
