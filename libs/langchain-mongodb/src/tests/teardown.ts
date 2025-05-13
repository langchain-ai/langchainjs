export default async function teardown() {
  // @ts-expect-error No __container on globalThis
  // however, this is the recommended way to share context between setup and teardown modules
  // https://jestjs.io/docs/configuration#globalsetup-string
  await globalThis.__container?.stop();
}
