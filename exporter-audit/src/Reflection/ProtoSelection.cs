using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Reflection;
using System.Text;
using Mafi.Core.Prototypes;

namespace CoI_Exporter {
    internal static class ProtoSelection {
        public static IEnumerable<object?> Enumerate(object? value) {
            if (value == null) yield break;
            if (value is string) {
                yield return value;
                yield break;
            }

            if (value is IEnumerable enumerable) {
                foreach (var item in enumerable) yield return item;
                yield break;
            }

            var getEnumerator = value.GetType().GetMethod("GetEnumerator", BindingFlags.Public | BindingFlags.Instance, null, Type.EmptyTypes, null);
            if (getEnumerator != null) {
                object? enumeratorObj = null;
                try {
                    enumeratorObj = getEnumerator.Invoke(value, null);
                }
                catch {
                    enumeratorObj = null;
                }

                if (enumeratorObj != null) {
                    var enumerator = enumeratorObj as IEnumerator;
                    if (enumerator != null) {
                        while (enumerator.MoveNext()) {
                            yield return enumerator.Current;
                        }
                        yield break;
                    }

                    var moveNext = enumeratorObj.GetType().GetMethod("MoveNext", BindingFlags.Public | BindingFlags.Instance);
                    var current = enumeratorObj.GetType().GetProperty("Current", BindingFlags.Public | BindingFlags.Instance);
                    if (moveNext != null && current != null) {
                        while (true) {
                            object? moved = moveNext.Invoke(enumeratorObj, null);
                            if (!(moved is bool hasNext) || !hasNext) break;
                            yield return current.GetValue(enumeratorObj, null);
                        }
                        yield break;
                    }
                }
            }

            yield return value;
        }

        public static Proto? TryGetProto(object? value) {
            return value as Proto;
        }

        public static object? GetMemberValue(object? obj, string name) {
            if (obj == null) return null;
            var member = FindReadableMember(obj.GetType(), name);
            if (member == null) return null;

            if (member is PropertyInfo prop) {
                return prop.GetValue(obj, null);
            }

            if (member is FieldInfo field) {
                return field.GetValue(obj);
            }

            return null;
        }

        public static MemberInfo? FindReadableMember(Type type, string name) {
            try {
                var property = type.GetProperty(name, BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);
                if (property != null && property.GetMethod != null && property.GetIndexParameters().Length == 0) {
                    return property;
                }
            }
            catch (AmbiguousMatchException) {
            }

            for (Type? current = type; current != null; current = current.BaseType) {
                var prop = current
                    .GetProperties(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                    .FirstOrDefault(p => p.Name == name && p.GetMethod != null && p.GetIndexParameters().Length == 0);
                if (prop != null) return prop;

                var field = current
                    .GetFields(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                    .FirstOrDefault(f => f.Name == name);
                if (field != null) return field;
            }

            return null;
        }

        public static object NormalizeScalar(object value) {
            var proto = TryGetProto(value);
            if (proto != null) return NormalizeId(proto.Id.ToString());
            if (value is bool || value is string) return value;
            if (value is byte || value is sbyte || value is short || value is ushort || value is int || value is uint || value is long || value is ulong || value is float || value is double || value is decimal) {
                return value;
            }
            var numeric = NormalizeNumericScalar(value);
            if (numeric != null) return numeric;
            return ValueToString(value);
        }

        public static object? NormalizeNumericScalar(object? value) {
            if (value == null) return null;

            if (value is byte || value is sbyte || value is short || value is ushort || value is int || value is uint || value is long || value is ulong || value is float || value is double || value is decimal) {
                return value;
            }

            if (value is bool || value is string) return null;

            if (value is Enum) {
                return Convert.ToInt64(value, CultureInfo.InvariantCulture);
            }

            object? inner = GetMemberValue(value, "Value");
            if (inner != null && !ReferenceEquals(inner, value)) {
                var normalized = NormalizeNumericScalar(inner);
                if (normalized != null) return normalized;
            }

            string text = ValueToString(value);
            if (string.IsNullOrWhiteSpace(text)) return null;
            if (long.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out long l)) return l;
            if (double.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out double d)) return d;
            return null;
        }

        public static string NormalizeId(string raw) {
            if (string.IsNullOrEmpty(raw)) return raw;

            var sb = new StringBuilder(raw.Length + 8);
            bool prevUnderscore = false;
            for (int i = 0; i < raw.Length; i++) {
                char c = raw[i];
                if (char.IsLetterOrDigit(c)) {
                    if (char.IsUpper(c) && i > 0 && !prevUnderscore && char.IsLower(raw[i - 1])) {
                        sb.Append('_');
                    }
                    sb.Append(char.ToLowerInvariant(c));
                    prevUnderscore = false;
                }
                else {
                    if (!prevUnderscore) {
                        sb.Append('_');
                        prevUnderscore = true;
                    }
                }
            }

            return sb.ToString().Trim('_');
        }

        public static string NormalizeState(string raw) {
            if (string.IsNullOrEmpty(raw)) return "Unit";
            string lower = raw.ToLowerInvariant();
            if (lower.Contains("loose")) return "Loose";
            if (lower.Contains("fluid") || lower.Contains("liquid") || lower.Contains("gas")) return "Fluid";
            if (lower.Contains("virtual")) return "Virtual";
            return "Unit";
        }

        public static string NormalizeStateFromTypeName(string typeName) {
            return NormalizeState(typeName);
        }

        public static string NormalizeStateFromProto(Proto proto) {
            string typeName = proto.GetType().Name;
            if (typeName.Contains("VirtualProductProto")) return "Virtual";
            if (typeName.Contains("LooseProductProto")) return "Loose";
            if (typeName.Contains("FluidProductProto") || typeName.Contains("MoltenProductProto")) return "Fluid";
            if (typeName.Contains("ProductProto")) return "Unit";
            object? state = GetMemberValue(proto, "State") ?? GetMemberValue(proto, "ProductState") ?? GetMemberValue(proto, "Type");
            if (state != null) return NormalizeState(state.ToString() ?? "");
            return "Unit";
        }

        public static bool HasProperty(object obj, string name) {
            return FindReadableMember(obj.GetType(), name) != null;
        }

        public static bool IsEntityCosts(object obj) {
            string name = obj.GetType().Name;
            if (name.Contains("EntityCosts")) return true;
            if (name.Contains("EntityCost")) return true;
            return HasProperty(obj, "Costs") && HasProperty(obj, "Total");
        }

        public static string GetGameVersionString() {
            try {
                return Mafi.GameVersion.FULL_VERSION;
            }
            catch {
                return "unknown";
            }
        }

        public static bool IsBuildingProto(Proto proto) {
            string typeName = proto.GetType().Name;
            if (typeName.Contains("BuildingProto")) return true;
            if (typeName.Contains("RecipeProto") || typeName.Contains("ProductProto") || typeName.Contains("ContractProto")) return false;
            if (HasProperty(proto, "Costs") && HasProperty(proto, "Layout") && HasProperty(proto, "EntityType")) return true;
            if (HasProperty(proto, "Ports") && HasProperty(proto, "Layout")) return true;
            return false;
        }

        public static bool HasRecipeProto(Proto proto) {
            object? recipeLike = GetMemberValue(proto, "Recipe")
                ?? GetMemberValue(proto, "Recipes");
            if (recipeLike == null) return false;

            return ExtractRecipeProtos(recipeLike).Count > 0;
        }

        public static List<Proto> ExtractRecipeProtos(object? recipeLike) {
            var list = new List<Proto>();
            if (recipeLike == null) return list;

            foreach (var item in Enumerate(recipeLike)) {
                var proto = item as Proto;
                if (proto != null && proto.GetType().Name.Contains("RecipeProto")) {
                    list.Add(proto);
                    continue;
                }

                object? nested = GetMemberValue(item, "Recipe")
                    ?? GetMemberValue(item, "RecipeProto")
                    ?? GetMemberValue(item, "Proto");
                var nestedProto = nested as Proto;
                if (nestedProto != null && nestedProto.GetType().Name.Contains("RecipeProto")) {
                    list.Add(nestedProto);
                }
            }

            return list;
        }

        public static void InferContractIoFromId(
            string contractId,
            out List<Dictionary<string, object?>> inputs,
            out List<Dictionary<string, object?>> outputs
        ) {
            inputs = new List<Dictionary<string, object?>>();
            outputs = new List<Dictionary<string, object?>>();

            const string marker = "Contract_Product_";
            const string middle = "_For_Product_";
            if (!contractId.StartsWith(marker, StringComparison.Ordinal) || !contractId.Contains(middle)) return;

            string payload = contractId.Substring(marker.Length);
            int split = payload.IndexOf(middle.Substring(1), StringComparison.Ordinal);
            if (split < 0) return;

            string left = payload.Substring(0, split);
            string right = payload.Substring(split + middle.Length - 1);

            if (!string.IsNullOrEmpty(left)) {
                inputs.Add(new Dictionary<string, object?> {
                    { "product_id", NormalizeId("Product_" + left) }
                });
            }

            if (!string.IsNullOrEmpty(right)) {
                outputs.Add(new Dictionary<string, object?> {
                    { "product_id", NormalizeId("Product_" + right) }
                });
            }
        }

        public static string ValueToString(object value) {
            if (value is string s) return s;
            if (value is IFormattable f) return f.ToString(null, CultureInfo.InvariantCulture);
            return value.ToString() ?? "";
        }
    }
}
