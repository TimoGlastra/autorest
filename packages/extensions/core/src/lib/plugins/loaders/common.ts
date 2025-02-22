import { Channel, SourceLocation } from "../../message";
import { DataHandle, indexToPosition } from "@azure-tools/datastore";
import { validateJson } from "@azure-tools/json";
import { AutorestContext } from "../../context";

/**
 * If a JSON file is provided, it checks that the syntax is correct.
 * And if the syntax is incorrect, it puts an error message .
 */
export async function checkSyntaxFromData(
  fileUri: string,
  handle: DataHandle,
  configView: AutorestContext,
): Promise<void> {
  if (fileUri.toLowerCase().endsWith(".json")) {
    const error = validateJson(await handle.readData());
    if (error) {
      configView.Message({
        Channel: Channel.Error,
        Text: `Syntax Error Encountered:  ${error.message}`,
        Source: [<SourceLocation>{ Position: await indexToPosition(handle, error.position), document: handle.key }],
      });
    }
  }
}
