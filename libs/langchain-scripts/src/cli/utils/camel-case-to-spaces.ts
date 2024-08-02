import _ from 'lodash';

export function camelCaseToSpaced(str: string) {
  return _.startCase(_.toLower(str)).replace(/\s/g, ' ');
}