export const Deno = {
  readFile: async () => {
    throw new Error("Deno.readFile is not available in Cloudflare Workers");
  },

  readDir: async function* () {
    return;
  },

  stdout: {
    writeSync() {
      return 0;
    }
  },

  stderr: {
    writeSync() {
      return 0;
    }
  }
};
