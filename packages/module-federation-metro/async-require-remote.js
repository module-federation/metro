if (!process.env.EXPO_OS) {
  process.env.EXPO_OS = "";
  require("./vendor/expo/async-require");
}

// TODO prod
