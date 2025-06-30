module.exports = {
  expo: {
    name: "Fantasy AI Ultimate",
    slug: "fantasy-ai-ultimate",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#1a1a1a"
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.fantasyai.ultimate"
    },
    android: {
      package: "com.fantasyai.ultimate"
    },
    web: {
      favicon: "./assets/favicon.png"
    }
  }
};