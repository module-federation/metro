import { MixedSourceMap } from "metro-source-map";
import relativizeSourceMapInline from "metro/src/lib/relativizeSourceMap";

function relativizeSerializedMap(
  map: string,
  sourceMapSourcesRoot: string
): string {
  const sourceMap: MixedSourceMap = JSON.parse(map);
  relativizeSourceMapInline(sourceMap, sourceMapSourcesRoot);
  return JSON.stringify(sourceMap);
}

export default relativizeSerializedMap;
