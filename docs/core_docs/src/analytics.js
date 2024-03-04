export const gtag = (...args) => {
  if (window.gtag) {
    window.gtag(...args);
  }
};