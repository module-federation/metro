// fetchAsync.native.ts requires process.env.EXPO_OS to be set
// since expo is optional, we set it to an empty string as a fallback
process.env.EXPO_OS = process.env.EXPO_OS ?? "";

require("./vendor/expo/async-require");
