export function customSort(
  elementsToSort: string[],
  sortingReference: string,
): string[] {
  const characterPriorityMap: Record<string, number> = {};
  sortingReference.split('').forEach((character, priority) => {
    characterPriorityMap[character] = priority;
  });

  return elementsToSort.sort((elementA, elementB) => {
    const firstCharA = elementA[0].toLowerCase();
    const firstCharB = elementB[0].toLowerCase();

    const priorityA = characterPriorityMap.hasOwnProperty(firstCharA)
      ? characterPriorityMap[firstCharA]
      : Number.MAX_SAFE_INTEGER;

    const priorityB = characterPriorityMap.hasOwnProperty(firstCharB)
      ? characterPriorityMap[firstCharB]
      : Number.MAX_SAFE_INTEGER;

    return priorityA - priorityB;
  });
}
