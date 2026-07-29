import { Config } from "@remotion/cli/config";
Config.setVideoImageFormat("jpeg");
Config.setEntryPoint("src/index.ts");
Config.overrideWebpackConfig((c) => ({
  ...c,
  resolve: { ...c.resolve, extensions: [...(c.resolve?.extensions ?? []), ".json"] },
}));
