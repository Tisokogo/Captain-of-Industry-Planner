using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Mafi.Core.Game;

namespace CoI_Exporter {
    internal static class GameSettingsBuilders {
        public static Dictionary<string, object?> BuildGameSettings(object? gameDifficultyConfig) {
            var root = new Dictionary<string, object?>();

            if (gameDifficultyConfig == null) {
                root["difficulty_options"] = new List<object>();
                root["difficulty_current_values"] = new Dictionary<string, object?>();
                root["mechanics_options"] = new List<object>();
                root["mechanics_current_values"] = new List<string>();
                return root;
            }

            var configType = gameDifficultyConfig.GetType();
            var difficulty = BuildDifficultySettings(configType, gameDifficultyConfig);
            root["difficulty_options"] = difficulty.Options;
            root["difficulty_current_values"] = difficulty.CurrentValues;

            var mechanics = BuildMechanicsSettings(gameDifficultyConfig);
            root["mechanics_options"] = mechanics.Options;
            root["mechanics_current_values"] = mechanics.CurrentValues;

            object? originalPreset = ProtoSelection.GetMemberValue(gameDifficultyConfig, "OriginalPreset");
            if (originalPreset != null) {
                root["original_preset"] = ProtoSelection.ValueToString(originalPreset);
            }

            return root;
        }

        private static (List<Dictionary<string, object?>> Options, Dictionary<string, object?> CurrentValues) BuildDifficultySettings(
            Type configType,
            object configInstance
        ) {
            var options = new List<Dictionary<string, object?>>();
            var currentValues = new Dictionary<string, object?>();

            foreach (var info in EnumerateSettingInfos(configType)) {
                if (info == null) continue;
                var property = ProtoSelection.GetMemberValue(info, "Property") as PropertyInfo;
                if (property == null) continue;

                string id = BuildSettingId(info, property);
                object? currentValue = SafeGetPropertyValue(property, configInstance);
                currentValues[id] = FormatSettingValue(currentValue);

                var entry = new Dictionary<string, object?> {
                    { "id", id },
                    { "title", ProtoSelection.ValueToString(ProtoSelection.GetMemberValue(info, "Title") ?? "") },
                    { "kind", GetSettingKind(property.PropertyType, info) },
                    { "current_value", FormatSettingValue(currentValue) }
                };

                string tooltip = ProtoSelection.ValueToString(ProtoSelection.GetMemberValue(info, "Tooltip") ?? "");
                if (!string.IsNullOrWhiteSpace(tooltip)) entry["tooltip"] = tooltip;

                var possibleValues = BuildPossibleValues(info, property.PropertyType);
                if (possibleValues.Count > 0) entry["possible_values"] = possibleValues;

                options.Add(entry);
            }

            return (options, currentValues);
        }

        private static (List<Dictionary<string, object?>> Options, List<string> CurrentValues) BuildMechanicsSettings(object configInstance) {
            var mechanicsType = typeof(GameMechanics);
            var possible = new List<Dictionary<string, object?>>();

            var mechanismFields = mechanicsType
                .GetFields(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static | BindingFlags.DeclaredOnly)
                .Where(f => typeof(GameMechanicApplier).IsAssignableFrom(f.FieldType))
                .ToList();

            var fieldToValue = new Dictionary<string, object?>();
            foreach (var field in mechanismFields) {
                object? value = null;
                try {
                    value = field.GetValue(null);
                }
                catch {
                    value = null;
                }

                fieldToValue[field.Name] = value;
                possible.Add(new Dictionary<string, object?> {
                    { "id", ProtoSelection.NormalizeId(field.Name) },
                    { "name", field.Name }
                });
            }

            var current = new List<string>();
            var selectedMechanics = ProtoSelection.GetMemberValue(configInstance, "SelectedMechanics");
            foreach (var item in ProtoSelection.Enumerate(selectedMechanics)) {
                if (item == null) continue;

                string? match = null;
                foreach (var kv in fieldToValue) {
                    if (ReferenceEquals(kv.Value, item)) {
                        match = ProtoSelection.NormalizeId(kv.Key);
                        break;
                    }
                }

                current.Add(match ?? ProtoSelection.NormalizeId(ProtoSelection.ValueToString(item)));
            }

            return (possible, current);
        }

        private static IEnumerable<object?> EnumerateSettingInfos(Type configType) {
            foreach (var field in configType.GetFields(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static | BindingFlags.DeclaredOnly)) {
                if (!typeof(IDiffSettingInfo).IsAssignableFrom(field.FieldType)) continue;

                object? value = null;
                try {
                    value = field.GetValue(null);
                }
                catch {
                    value = null;
                }

                if (value != null) yield return value;
            }
        }

        private static string BuildSettingId(object info, PropertyInfo property) {
            object? valueMemberName = ProtoSelection.GetMemberValue(info, "ValueMemberName");
            string raw = valueMemberName != null ? ProtoSelection.ValueToString(valueMemberName) : property.Name;
            return ProtoSelection.NormalizeId(raw);
        }

        private static string GetSettingKind(Type propertyType, object info) {
            if (propertyType == typeof(bool)) return "bool";
            if (propertyType.IsEnum) return "enum";
            if (propertyType == typeof(string)) return "string";
            if (propertyType.FullName == "Mafi.Percent") return "percent";
            object? options = ProtoSelection.GetMemberValue(info, "Options");
            if (options is IEnumerable && !(options is string)) return "value_list";
            return "value";
        }

        private static List<Dictionary<string, object?>> BuildPossibleValues(object info, Type propertyType) {
            var list = new List<Dictionary<string, object?>>();
            object? options = ProtoSelection.GetMemberValue(info, "Options");

            var enumLabels = GetEnumLabels(info);

            if (options is IEnumerable enumerable && !(options is string)) {
                int index = 0;
                foreach (var item in ProtoSelection.Enumerate(options)) {
                    if (item == null) {
                        index++;
                        continue;
                    }

                    var entry = new Dictionary<string, object?> {
                        { "value", FormatSettingValue(item) }
                    };

                    string label = FormatOptionLabel(item);
                    if (propertyType.IsEnum && index < enumLabels.Count && !string.IsNullOrWhiteSpace(enumLabels[index])) {
                        label = enumLabels[index];
                    }

                    if (!string.IsNullOrWhiteSpace(label)) entry["label"] = label;
                    list.Add(entry);
                    index++;
                }

                return list;
            }

            if (propertyType == typeof(bool)) {
                list.Add(new Dictionary<string, object?> { { "value", false }, { "label", "false" } });
                list.Add(new Dictionary<string, object?> { { "value", true }, { "label", "true" } });
                return list;
            }

            if (propertyType.IsEnum) {
                var enumNames = Enum.GetNames(propertyType);
                var enumValues = Enum.GetValues(propertyType);
                for (int i = 0; i < enumNames.Length; i++) {
                    var rawValue = enumValues.GetValue(i);
                    var entry = new Dictionary<string, object?> {
                        { "value", FormatSettingValue(rawValue) },
                        { "label", i < enumLabels.Count && !string.IsNullOrWhiteSpace(enumLabels[i]) ? enumLabels[i] : enumNames[i] }
                    };
                    list.Add(entry);
                }
            }

            return list;
        }

        private static List<string> GetEnumLabels(object info) {
            var labels = new List<string>();
            object? rawLabels = ProtoSelection.GetMemberValue(info, "m_labels");
            if (!(rawLabels is IEnumerable enumerable) || rawLabels is string) return labels;

            foreach (var item in enumerable) {
                labels.Add(item == null ? "" : ProtoSelection.ValueToString(item));
            }

            return labels;
        }

        private static string FormatOptionLabel(object? value) {
            if (value == null) return "";
            if (value is bool b) return b ? "true" : "false";
            if (value is Enum) return value.ToString() ?? "";
            if (value.GetType().FullName == "Mafi.Percent") {
                return ProtoSelection.ValueToString(value);
            }
            object? normalized = ProtoSelection.NormalizeNumericScalar(value);
            if (normalized != null) return ProtoSelection.ValueToString(normalized);
            return ProtoSelection.ValueToString(value);
        }

        private static object? FormatSettingValue(object? value) {
            if (value == null) return null;
            if (value is bool || value is string) return value;
            if (value is Enum) return value.ToString();

            object? numeric = ProtoSelection.NormalizeNumericScalar(value);
            if (numeric != null) return numeric;

            return ProtoSelection.ValueToString(value);
        }

        private static object? SafeGetPropertyValue(PropertyInfo property, object target) {
            try {
                return property.GetValue(target, null);
            }
            catch {
                return null;
            }
        }
    }
}
