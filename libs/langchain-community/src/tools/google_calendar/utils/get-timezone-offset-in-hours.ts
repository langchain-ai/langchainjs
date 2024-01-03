const getTimezoneOffsetInHours = () => {
  const offsetInMinutes = new Date().getTimezoneOffset();
  const offsetInHours = -offsetInMinutes / 60;
  return offsetInHours;
};

export { getTimezoneOffsetInHours };
