export default async function teardown() {
  // @ts-expect-error No __container on globalThis
  await globalThis.__container?.stop();
}
