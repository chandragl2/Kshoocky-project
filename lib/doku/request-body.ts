export async function readBoundedText(
  body: ReadableStream<Uint8Array> | null,
  contentLengthHeader: string | null,
  maximumBytes: number,
) {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 0) {
    throw new Error("request_body_limit_invalid");
  }
  if (
    contentLengthHeader !== null &&
    Number.isFinite(Number(contentLengthHeader)) &&
    Number(contentLengthHeader) > maximumBytes
  ) {
    if (body) await body.cancel();
    throw new Error("request_body_too_large");
  }
  if (!body) throw new Error("request_body_missing");

  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  let bytesRead = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    if (bytesRead > maximumBytes) {
      await reader.cancel();
      throw new Error("request_body_too_large");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}
