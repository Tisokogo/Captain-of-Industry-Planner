using System.Collections;
using System.Collections.Generic;
using System.Text;

namespace CoI_Exporter {
    internal static class JsonExporter {
        public static string BuildJson(
            List<Dictionary<string, object?>> products,
            List<Dictionary<string, object?>> recipes,
            List<Dictionary<string, object?>> buildings,
            List<Dictionary<string, object?>> contracts,
            List<Dictionary<string, object?>> research,
            Dictionary<string, object?>? gameSettings
        ) {
            var root = new Dictionary<string, object?> {
                { "game_version", ProtoSelection.GetGameVersionString() },
                { "schema_version", 3 },
                { "products", products },
                { "recipes", recipes },
                { "buildings", buildings },
                { "contracts", contracts },
                { "research", research },
                { "game_settings", gameSettings ?? new Dictionary<string, object?>() }
            };

            var sb = new StringBuilder(4096);
            WriteJsonValue(sb, root, 0);
            sb.Append("\n");
            return sb.ToString();
        }

        private static void WriteJsonValue(StringBuilder sb, object? value, int indent) {
            if (value == null) {
                sb.Append("null");
                return;
            }

            if (value is string s) {
                sb.Append("\"").Append(EscapeJson(s)).Append("\"");
                return;
            }

            if (value is bool b) {
                sb.Append(b ? "true" : "false");
                return;
            }

            if (value is IDictionary dict) {
                WriteJsonObject(sb, dict, indent);
                return;
            }

            if (value is IEnumerable enumerable) {
                WriteJsonArray(sb, enumerable, indent);
                return;
            }

            if (value is System.IFormattable f) {
                sb.Append(f.ToString(null, System.Globalization.CultureInfo.InvariantCulture));
                return;
            }

            sb.Append("\"").Append(EscapeJson(value.ToString() ?? "")).Append("\"");
        }

        private static void WriteJsonObject(StringBuilder sb, IDictionary dict, int indent) {
            sb.Append("{");
            bool first = true;
            foreach (DictionaryEntry kvp in dict) {
                if (!first) sb.Append(",");
                sb.Append("\n").Append(Indent(indent + 1));
                sb.Append("\"").Append(EscapeJson(kvp.Key.ToString() ?? "")).Append("\": ");
                WriteJsonValue(sb, kvp.Value, indent + 1);
                first = false;
            }
            if (!first) sb.Append("\n").Append(Indent(indent));
            sb.Append("}");
        }

        private static void WriteJsonArray(StringBuilder sb, IEnumerable enumerable, int indent) {
            sb.Append("[");
            bool first = true;
            foreach (var item in enumerable) {
                if (!first) sb.Append(",");
                sb.Append("\n").Append(Indent(indent + 1));
                WriteJsonValue(sb, item, indent + 1);
                first = false;
            }
            if (!first) sb.Append("\n").Append(Indent(indent));
            sb.Append("]");
        }

        private static string Indent(int level) {
            return new string(' ', level * 2);
        }

        private static string EscapeJson(string value) {
            if (value == null) return "";
            var sb = new StringBuilder(value.Length + 8);
            foreach (char c in value) {
                switch (c) {
                    case '\"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\b': sb.Append("\\b"); break;
                    case '\f': sb.Append("\\f"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < 0x20) {
                            sb.Append("\\u");
                            sb.Append(((int)c).ToString("x4"));
                        } else {
                            sb.Append(c);
                        }
                        break;
                }
            }
            return sb.ToString();
        }
    }
}
