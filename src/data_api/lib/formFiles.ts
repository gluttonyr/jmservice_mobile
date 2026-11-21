import { Platform } from 'react-native';

// Files are added to a FormData the React Native way: formData.append('file', { uri, name, type }).
// Phones send that file; a browser does not understand it and sends the text "[object Object]" instead,
// so on the website the banner, event, sticker, profile photo or chat image was saved without its image.
// On the website this keeps those files aside, then reads them (blob:, data: or http uri) and adds the
// real file just before the request leaves (resolveFormFiles, called by api.ts).

type NativeFile = { uri: string; name?: string; type?: string };

const pending = new WeakMap<FormData, { field: string; file: NativeFile }[]>();

const isNativeFile = (value: unknown): value is NativeFile =>
  !!value
  && typeof value === 'object'
  && typeof (value as NativeFile).uri === 'string'
  && !(typeof Blob !== 'undefined' && value instanceof Blob);

if (Platform.OS === 'web' && typeof FormData !== 'undefined') {
  const originalAppend = FormData.prototype.append;
  FormData.prototype.append = function append(this: FormData, field: string, value: any, fileName?: string) {
    if (isNativeFile(value)) {
      const list = pending.get(this) ?? [];
      list.push({ field, file: value });
      pending.set(this, list);
      return;
    }
    return fileName === undefined
      ? originalAppend.call(this, field, value)
      : originalAppend.call(this, field, value, fileName);
  } as typeof FormData.prototype.append;
}

export async function resolveFormFiles(formData: FormData): Promise<void> {
  const list = pending.get(formData);
  if (!list?.length) return;
  pending.delete(formData);
  for (const { field, file } of list) {
    const blob = await (await fetch(file.uri)).blob();
    const type = file.type || blob.type || 'application/octet-stream';
    const name = file.name || `file_${Date.now()}`;
    formData.append(field, new File([blob], name, { type }));
  }
}
