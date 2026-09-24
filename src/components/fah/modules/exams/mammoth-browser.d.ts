// Minimal typing for mammoth's browser bundle (used by src/lib/fah/services/exam-import.ts).
declare module "mammoth/mammoth.browser" {
  const mammoth: {
    extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string; messages: { type: string; message: string }[] }>;
  };
  export default mammoth;
}
