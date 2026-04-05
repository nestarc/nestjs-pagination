export type FilterOperator =
  | '$eq'
  | '$ne'
  | '$gt'
  | '$gte'
  | '$lt'
  | '$lte'
  | '$in'
  | '$nin'
  | '$ilike'
  | '$btw'
  | '$null'
  | '$not:null';

export type SortOrder = 'ASC' | 'DESC';
