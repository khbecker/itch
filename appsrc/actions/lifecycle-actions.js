
import {createAction} from 'redux-actions'

import {
  BOOT,

  SETUP_STATUS,
  SETUP_DONE,

  PREPARE_QUIT,
  QUIT_WHEN_MAIN,
  QUIT,
  QUIT_ELECTRON_APP
} from '../constants/action-types'

export const boot = createAction(BOOT)

export const setupStatus = createAction(SETUP_STATUS)
export const setupDone = createAction(SETUP_DONE)

export const prepareQuit = createAction(PREPARE_QUIT)
export const quitWhenMain = createAction(QUIT_WHEN_MAIN)
export const quit = createAction(QUIT)
export const quitElectronApp = createAction(QUIT_ELECTRON_APP)
