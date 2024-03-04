export default const gtag = (...args) => {
  if (window.gtag) {
    window.gtag(...args);
  }
};