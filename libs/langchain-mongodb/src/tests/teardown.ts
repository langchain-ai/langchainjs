export default async function teardown() {
  await globalThis.__container?.stop();
}
