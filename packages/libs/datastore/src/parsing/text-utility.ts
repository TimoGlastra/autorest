/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DataHandle } from "../data-store";
import { Position as sourceMapPosition } from "source-map";

const regexNewLine = /\r?\n/g;

/**
 * Return an array containg the indexes where each line start. Each cell has the index to its coresponding line.
 * @param text Text to index.
 */
export function getLineIndices(text: string): Array<number> {
  const indices = [0];

  let match: RegExpExecArray | null;
  while ((match = regexNewLine.exec(text)) !== null) {
    indices.push(match.index + match[0].length);
  }

  return indices;
}

export function Lines(text: string): Array<string> {
  return text.split(regexNewLine);
}

/**
 * Retrieve the position(Line,Column) from the index in the source.
 * @param text Source.
 * @param index Index.
 */
export function indexToPositionInText(text: string, index: number): sourceMapPosition {
  return indexToPositionFromLineIndices(getLineIndices(text), index);
}

/**
 * Retrieve the position(Line,Column) from the index in the source.
 * @param text Source.
 * @param index Index.
 */
export async function indexToPosition(text: DataHandle, index: number): Promise<sourceMapPosition> {
  return indexToPositionFromLineIndices(await text.lineIndices(), index);
}

/**
 * Retrieve the position(Line,Column) from the index in the source.
 * @param text Source.
 * @param index Index.
 */
export function indexToPositionFromLineIndices(startIndices: number[], index: number): sourceMapPosition {
  // bin. search for last `<item> <= index`
  let lineIndexMin = 0;
  let lineIndexMax = startIndices.length;
  while (lineIndexMin < lineIndexMax - 1) {
    const lineIndex = ((lineIndexMin + lineIndexMax) / 2) | 0;
    if (startIndices[lineIndex] <= index) {
      lineIndexMin = lineIndex;
    } else {
      lineIndexMax = lineIndex;
    }
  }

  return {
    column: 1 + index - startIndices[lineIndexMin],
    line: 1 + lineIndexMin,
  };
}
