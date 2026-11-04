import type { Report } from '@bugcrumbs/core'

/** Built-in report actions. Copies work on the clipboard; downloads save a file. */
export type BuiltInAction = 'copy-ai' | 'copy-markdown' | 'copy-jira' | 'download-html' | 'download-json' | 'download-markdown'

export interface CustomActionContext {
  /** The screenshot as a PNG, when the tester took one. */
  screenshot?: Blob
}

/**
 * An action the host app adds, e.g. "Send to our webhook". It runs inside the click, so it may write
 * to the clipboard. Bugcrumbs itself never sends data anywhere; a custom action may, by your choice.
 */
export interface CustomAction {
  label: string
  run: (report: Report, context: CustomActionContext) => void | Promise<void>
}

export type ReportAction = BuiltInAction | CustomAction

/** `required` and `optional` show the field; `hidden` leaves it out of the form. */
export type FieldMode = 'required' | 'optional' | 'hidden'

/** An extra field on the report form; its value appears in every export under `label`. */
export interface CustomField {
  /** Stable key for the field. */
  id: string
  label: string
  /** Default: `text`. */
  type?: 'text' | 'textarea' | 'select'
  /** Choices for `select`. */
  options?: string[]
  required?: boolean
}

export interface ReportFormFields {
  /** "What happened". Default: `optional`. */
  description?: FieldMode
  /** "Expected result". Default: `optional`. */
  expected?: FieldMode
  /** Default: `optional`. */
  severity?: Exclude<FieldMode, 'required'>
  custom?: CustomField[]
}

export interface PanelOptions {
  /** Buttons always shown, the first as the primary action (also run by Enter). Default: `['copy-ai', 'download-html']`. */
  actions?: ReportAction[]
  /** Actions behind a "More formats" toggle. Default: the remaining built-in actions. Pass `[]` to hide it. */
  moreActions?: ReportAction[]
  /** Which form fields to show and require. The title is always required. */
  fields?: ReportFormFields
  /**
   * "Save and start next": keeps finished reports in this browser (IndexedDB) for exporting all at
   * once as CSV or JSON. Saving clears the captured history for the next bug. Default: `true`.
   */
  savedReports?: boolean
}

export const DEFAULT_ACTIONS: BuiltInAction[] = ['copy-ai', 'download-html']
export const DEFAULT_MORE_ACTIONS: BuiltInAction[] = ['copy-markdown', 'copy-jira', 'download-json', 'download-markdown']
