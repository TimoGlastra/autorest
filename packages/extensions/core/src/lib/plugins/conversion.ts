import { DataHandle, IFileSystem, QuickDataSource } from "@azure-tools/datastore";
import { PipelinePlugin } from "../pipeline/common";
import { convertOai2ToOai3Files } from "@azure-tools/oai2-to-oai3";
import { cloneDeep } from "lodash";

/* @internal */
export function createSwaggerToOpenApi3Plugin(fileSystem?: IFileSystem): PipelinePlugin {
  return async (config, input, sink) => {
    const files = await input.enum();
    const inputs: DataHandle[] = [];
    for (const file of files) {
      inputs.push(await input.readStrict(file));
    }
    const results = await convertOai2ToOai3Files(inputs);
    const resultHandles: DataHandle[] = [];
    for (const { result, name, mappings } of results) {
      const input = inputs.find((x) => x.originalFullPath === name);
      if (input === undefined) {
        throw new Error(`Unexpected error while trying to map output of file ${name}. It cannot be found as an input.`);
      }
      const out = await sink.writeObject("OpenAPI", cloneDeep(result), input.identity, undefined, {
        pathMappings: mappings,
      });
      resultHandles.push(await sink.forward(input.description, out));
    }
    return new QuickDataSource(resultHandles, input.pipeState);
  };
}
