export const FORM_SUBMITTED = 'form.submitted';

/** Emitted after a submission is stored; notification happens off the request. */
export class FormSubmittedEvent {
  constructor(
    public readonly submissionId: string,
    public readonly websiteId: string,
    public readonly formId: string,
    public readonly formName: string,
    public readonly notifyEmails: string[],
    public readonly data: Record<string, unknown>,
  ) {}
}
