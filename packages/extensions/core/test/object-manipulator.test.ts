/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { DataStore } from "@azure-tools/datastore";
import { manipulateObject } from "../src/lib/plugins/transformer/object-manipulator";
import { createSandbox } from "@azure-tools/datastore";

const safeEval = createSandbox();

const exampleObject = `
host: localhost:27332
paths:
  "/api/circular":
    get:
      description: fun time
      operationId: Circular
      responses:
        '200':
          schema:
            "$ref": "#/definitions/NodeA"
      parameters:
        - name: Param1
          in: query
          schema:
            type: string
        - name: Param2
          in: query
          schema:
            type: string
        - name: Param3
          in: query
          schema:
            type: string
    post:
      description: post fun time
      operationId: Postcircular
definitions:
  NodeA:
    description: Description
    type: object
    properties:
      child:
        "$ref": "#/definitions/NodeA"
  NodeB:
    type: object
    properties:
      child:
        "$ref": "#/definitions/NodeB"`;

describe("ObjectManipulator", () => {
  it("any hit", async () => {
    // setup
    const dataStore = new DataStore();
    const input = await dataStore.writeData("mem://input.yaml", exampleObject, "input-file", ["input.yaml"]);

    const expectHit = async (jsonQuery: string, anyHit: boolean) => {
      const result = await manipulateObject(input, dataStore.getDataSink(), jsonQuery, (_, x) => x);
      expect(result.anyHit).toEqual(anyHit);
    };

    await expectHit("$..put", false);
    await expectHit("$..post", true);
    await expectHit("$..get", true);
    await expectHit("$.parameters", false);
    await expectHit("$.definitions", true);
    await expectHit("$..summary", false);
    await expectHit("$..description", true);
    await expectHit("$.definitions[?(@.summary)]", false);
    await expectHit("$.definitions[?(@.description)]", true);
    await expectHit('$.definitions[?(@.description=="Descriptio")]', false);
    await expectHit('$.definitions[?(@.description=="Description")]', true);
    await expectHit('$..[?(@.description=="Descriptio")]', false);
    await expectHit('$..[?(@.description=="Description")]', true);
  });

  it("removal", async () => {
    // setup
    const dataStore = new DataStore();
    const input = await dataStore.writeData("mem://input.yaml", exampleObject, "input-file", ["input.yaml"]);

    // remove all models that don't have a description
    const result = await manipulateObject(
      input,
      dataStore.getDataSink(),
      "$.definitions[?(!@.description)]",
      (_, x) => undefined,
    );
    expect(result.anyHit).toBe(true);
    const resultRaw = await result.result.readData();
    expect(resultRaw).toContain("NodeA");
    expect(resultRaw).not.toContain("NodeB");
  });

  it("update", async () => {
    // setup
    const dataStore = new DataStore();
    const input = await dataStore.writeData("mem://input.yaml", exampleObject, "input-file", ["input.yaml"]);

    {
      // override all existing model descriptions
      const bestDescriptionEver = "best description ever";
      const result = await manipulateObject(
        input,
        dataStore.getDataSink(),
        "$.definitions.*.description",
        (_, x) => bestDescriptionEver,
      );
      expect(result.anyHit).toBe(true);
      const resultObject = await result.result.readObject<any>();
      expect(resultObject.definitions.NodeA.description).toEqual(bestDescriptionEver);
    }
    {
      // override & insert all model descriptions
      const bestDescriptionEver = "best description ever";
      const result = await manipulateObject(input, dataStore.getDataSink(), "$.definitions.*", (_, x) => {
        x.description = bestDescriptionEver;
        return x;
      });
      expect(result.anyHit).toBe(true);
      const resultObject = await result.result.readObject<any>();
      expect(resultObject.definitions.NodeA.description).toEqual(bestDescriptionEver);
      expect(resultObject.definitions.NodeB.description).toEqual(bestDescriptionEver);
    }
    {
      // make all descriptions upper case
      const bestDescriptionEver = "best description ever";
      const result = await manipulateObject(input, dataStore.getDataSink(), "$..description", (_, x) =>
        (<string>x).toUpperCase(),
      );
      expect(result.anyHit).toBe(true);
      const resultObject = await result.result.readObject<any>();
      expect(resultObject.definitions.NodeA.description).toEqual("DESCRIPTION");
      expect(resultObject.paths["/api/circular"].get.description).toEqual("FUN TIME");
    }
    {
      // make all descriptions upper case by using safe-eval
      const bestDescriptionEver = "best description ever";
      const result = await manipulateObject(input, dataStore.getDataSink(), "$..description", (_, x) =>
        safeEval("$.toUpperCase()", { $: x }),
      );
      expect(result.anyHit).toBe(true);
      const resultObject = await result.result.readObject<any>();
      expect(resultObject.definitions.NodeA.description).toEqual("DESCRIPTION");
      expect(resultObject.paths["/api/circular"].get.description).toEqual("FUN TIME");
    }
  });

  it("skip-transform-failure", async () => {
    // setup
    const dataStore = new DataStore();
    const input = await dataStore.writeData("mem://input.yaml", exampleObject, "input-file", ["input.yaml"]);

    {
      // the first override should fail but the second should be still executed
      const bestDescriptionEver = "best description ever";
      let firstRun = true;

      const result = await manipulateObject(input, dataStore.getDataSink(), "$.paths.*.*", (_, x) => {
        if (firstRun) {
          firstRun = false;
          throw Error("This error should have been suppressed in the manipulateObject(...).");
        } else {
          x.description = bestDescriptionEver;
          return x;
        }
      });

      expect(result.anyHit).toBe(true);
      const resultObject = await result.result.readObject<any>();
      expect(resultObject.paths["/api/circular"].get.description).toEqual("fun time");
      expect(resultObject.paths["/api/circular"].post.description).toEqual(bestDescriptionEver);
    }
  });
});
