// Jest mock for file-type (ESM-only package, not compatible with babel-jest CJS transform)
module.exports = {
  fileTypeFromBuffer: async () => ({ mime: "image/jpeg", ext: "jpg" }),
  fileTypeFromFile: async () => ({ mime: "image/jpeg", ext: "jpg" }),
};
