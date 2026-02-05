export default {
  build: {
    rollupOptions: {
      external: [/^node:/, "typeorm", "reflect-metadata"],
    },
  },
};
