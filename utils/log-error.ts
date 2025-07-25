export const logError = (desc: string, error: any) => {
  if (__DEV__) {
    console.error(desc, error);
  }
};
