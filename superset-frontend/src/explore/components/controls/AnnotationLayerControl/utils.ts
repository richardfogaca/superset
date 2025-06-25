/* eslint-disable no-param-reassign */
export function correctAllColumns(valueOptions: any[]) {
  return valueOptions.map(option => {
    function correctColumns(columns: any) {
      return columns.map((column: any) => {
        if (typeof column === 'object' && column.label) {
          return column.label;
        }
        return column;
      });
    }
    if (option.slice) {
      if (
        option.slice.form_data &&
        Array.isArray(option.slice.form_data.all_columns)
      ) {
        option.slice.form_data.all_columns = correctColumns(
          option.slice.form_data.all_columns,
        );
      }
      if (option.slice.data && Array.isArray(option.slice.data.all_columns)) {
        option.slice.data.all_columns = correctColumns(
          option.slice.data.all_columns,
        );
      }
    }
    return option;
  });
}
