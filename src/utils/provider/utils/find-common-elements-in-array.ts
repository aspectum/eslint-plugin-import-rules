/**
 * Given 2 arrays, returns the first index at which their respective elements are different
 */
export const findCommonElementsInArray = (first: any[], second: any[]) => {
  let i = 0;
  for (i = 0; i < first.length && i < second.length; i++) {
    if (first[i] !== second[i]) {
      break;
    }
  }
  return i;
};
