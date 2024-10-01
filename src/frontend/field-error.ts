export class FieldError {
  errors: Set<string> = new Set<string>();

  set(
    errKey: string,
    inputField: HTMLInputElement,
    label: HTMLElement,
    labelText: string
  ): void {
    inputField.classList.add('input-error');
    label.classList.remove('hidden');
    label.innerHTML = labelText;
    this.errors.add(errKey);
  }

  remove(
    errKey: string,
    inputField: HTMLInputElement,
    label: HTMLElement
  ): void {
    inputField.classList.remove('input-error');
    label.classList.add('hidden');
    label.innerHTML = '';
    this.errors.delete(errKey);
  }

  isEmpty(): boolean {
    return this.errors.size === 0;
  }
}
