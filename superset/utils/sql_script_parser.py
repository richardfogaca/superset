import sqlparse
from flask_babel import lazy_gettext as _
from superset.sql.parse import SQLScript
from superset.exceptions import QueryObjectValidationError


class SQLScriptParser:

    def __init__(self, sql: str, engine: str):
        try:
            self.script = SQLScript(sql, engine)
            self.statements = self.script.statements
            self.is_native_compatibility = True
            self.sql_formatted = sqlparse.format(sql.strip("\t\r\n; "), strip_comments=True)
        except Exception:
            try:
                # Compability (sqlglot parse issues)
                self.sql_formatted = sqlparse.format(sql.strip("\t\r\n; "), strip_comments=True)
                if not self.sql_formatted:
                    raise QueryObjectValidationError(
                        _("Virtual dataset query cannot be empty")
                    )
                self._parsed = sqlparse.parse(self.sql_formatted)
                self.statements = sqlparse.split(self.sql_formatted)
                self.is_native_compatibility = False
            except Exception:
                raise QueryObjectValidationError(_("Query syntax incorrect"))

    def has_mutation(self):
        if self.is_native_compatibility:
            return self.script.has_mutation()

        # Compability (sqlglot parse issues)
        if not self._parsed[0].get_type() == "UNKNOWN":
            return True
