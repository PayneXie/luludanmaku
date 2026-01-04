/**
 * Example utility function
 * @param {string} name
 * @returns {string}
 */
export const formatGreeting = (name) => {
  return `Hello, ${name}!`;
};

/**
 * Class name joiner
 * @param {...string} classes
 * @returns {string}
 */
export const cn = (...classes) => {
  return classes.filter(Boolean).join(' ');
};
