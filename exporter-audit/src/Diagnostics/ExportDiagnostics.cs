using System.Collections.Generic;
using System.Linq;
using System.Text;
using Mafi.Core.Prototypes;

namespace CoI_Exporter {
    internal static class ExportDiagnostics {
        public static string BuildLog(
            ProtosDb db,
            List<Dictionary<string, object?>> recipes,
            List<Dictionary<string, object?>> buildings,
            List<Dictionary<string, object?>> products,
            List<Dictionary<string, object?>> contracts,
            Dictionary<string, object?>? gameSettings,
            IconExportPipeline.IconExportSummary? iconSummary
        ) {
            var log = new StringBuilder(2048);
            log.AppendLine("OK " + System.DateTime.UtcNow.ToString("u"));
            log.AppendLine("Recipes: " + recipes.Count);
            log.AppendLine("Buildings: " + buildings.Count);
            log.AppendLine("Products: " + products.Count);
            log.AppendLine("Contracts: " + contracts.Count);
            if (gameSettings != null && gameSettings.Count > 0) {
                log.AppendLine("Game settings: " + gameSettings.Count);
            }
            if (iconSummary != null) {
                log.AppendLine("Building candidates: " + iconSummary.BuildingCandidates);
                log.AppendLine("Buildings skipped without recipe: " + iconSummary.BuildingSkippedNoRecipe);
                log.AppendLine("Products considered: " + iconSummary.ProductsConsidered);
                log.AppendLine("Buildings considered: " + iconSummary.BuildingsConsidered);
                log.AppendLine("Icons exported: " + iconSummary.TotalExported);
                log.AppendLine("Icons exported as PNG: " + (iconSummary.ProductsPngExported + iconSummary.BuildingsPngExported));
                log.AppendLine("Icons exported as JPG: " + (iconSummary.ProductsJpgExported + iconSummary.BuildingsJpgExported));
                log.AppendLine("Missing icon path: " + iconSummary.MissingIconPath);
                log.AppendLine("Missing asset: " + iconSummary.MissingAsset);
                log.AppendLine("Encoding failures: " + iconSummary.EncodeFailures);
                log.AppendLine("Icon export failures: " + iconSummary.Failures);
                if (iconSummary.ProductDebugLines.Count > 0) {
                    log.AppendLine("Product icon debug sample:");
                    foreach (string line in iconSummary.ProductDebugLines.Take(15)) {
                        log.AppendLine("  " + line);
                    }
                }
                if (iconSummary.BuildingDebugLines.Count > 0) {
                    log.AppendLine("Building icon debug sample:");
                    foreach (string line in iconSummary.BuildingDebugLines.Take(30)) {
                        log.AppendLine("  " + line);
                    }
                }
            }
            log.AppendLine("");
            log.AppendLine("SampleProperties:");
            log.AppendLine("");
            log.AppendLine(DumpSampleProperties(db, "RecipeProto", 3));
            log.AppendLine(DumpSampleProperties(db, "BuildingProto", 3));
            log.AppendLine(DumpSampleProperties(db, "ProductProto", 3));
            log.AppendLine(DumpSampleProperties(db, "ContractProto", 3));
            log.AppendLine(DumpRecipeIoSamples(db));
            return log.ToString();
        }

        private static string DumpSampleProperties(ProtosDb db, string typeNameContains, int maxCount) {
            var sb = new StringBuilder(1024);
            sb.AppendLine(typeNameContains + " samples:");

            var samples = db.All<Proto>()
                .Where(p => p.GetType().Name.Contains(typeNameContains))
                .Take(maxCount)
                .ToList();

            if (samples.Count == 0) {
                sb.AppendLine("  (none found)");
                sb.AppendLine("");
                return sb.ToString();
            }

            foreach (var proto in samples) {
                sb.AppendLine("  ID: " + proto.Id.ToString());
                sb.AppendLine("  Name: " + proto.Strings.Name.ToString());
                sb.AppendLine("  Type: " + proto.GetType().FullName);
                sb.AppendLine("  Properties:");

                var props = proto.GetType().GetProperties(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                foreach (var prop in props) {
                    if (prop.GetIndexParameters().Length > 0) continue;
                    object? value = null;
                    try {
                        value = prop.GetValue(proto, null);
                    }
                    catch {
                        value = "<error>";
                    }
                    sb.AppendLine("    " + prop.Name + ": " + Truncate(ProtoSelection.ValueToString(value ?? ""), 200));
                }
                sb.AppendLine("");
            }
            return sb.ToString();
        }

        private static string DumpRecipeIoSamples(ProtosDb db) {
            var sb = new StringBuilder(2048);
            sb.AppendLine("Recipe IO samples:");

            var recipe = db.All<Proto>()
                .FirstOrDefault(p => p.GetType().Name.Contains("RecipeProto"));

            if (recipe == null) {
                sb.AppendLine("  (no recipe proto found)");
                sb.AppendLine("");
                return sb.ToString();
            }

            object? inputs = ProtoSelection.GetMemberValue(recipe, "AllUserVisibleInputs")
                ?? ProtoSelection.GetMemberValue(recipe, "Inputs")
                ?? ProtoSelection.GetMemberValue(recipe, "Input");
            object? outputs = ProtoSelection.GetMemberValue(recipe, "AllUserVisibleOutputs")
                ?? ProtoSelection.GetMemberValue(recipe, "Outputs")
                ?? ProtoSelection.GetMemberValue(recipe, "Output");

            object? firstInput = ProtoSelection.Enumerate(inputs).FirstOrDefault();
            object? firstOutput = ProtoSelection.Enumerate(outputs).FirstOrDefault();

            sb.AppendLine(DumpObjectProperties("  FirstInput", firstInput));
            sb.AppendLine(DumpNestedQuantityProperties("  FirstInput", firstInput));
            sb.AppendLine(DumpObjectProperties("  FirstOutput", firstOutput));
            sb.AppendLine(DumpNestedQuantityProperties("  FirstOutput", firstOutput));
            sb.AppendLine("");
            return sb.ToString();
        }

        private static string DumpNestedQuantityProperties(string label, object? obj) {
            object? nested = ProtoSelection.GetMemberValue(obj, "ProductQuantity")
                ?? ProtoSelection.GetMemberValue(obj, "RecipeProductQuantity")
                ?? ProtoSelection.GetMemberValue(obj, "SourceProductQuantity");
            return DumpObjectProperties(label + ".NestedQuantity", nested);
        }

        private static string DumpObjectProperties(string label, object? obj) {
            var sb = new StringBuilder(1024);
            sb.AppendLine(label + ":");

            if (obj == null) {
                sb.AppendLine("  (null)");
                return sb.ToString();
            }

            sb.AppendLine("  Type: " + (obj.GetType().FullName ?? obj.GetType().Name));
            foreach (var prop in obj.GetType().GetProperties(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance)) {
                if (prop.GetIndexParameters().Length > 0) continue;

                object? value;
                try {
                    value = prop.GetValue(obj, null);
                }
                catch {
                    value = "<error>";
                }

                sb.AppendLine("  " + prop.Name + ": " + Truncate(ProtoSelection.ValueToString(value ?? ""), 200));
            }

            return sb.ToString();
        }

        private static string Truncate(string value, int maxLen) {
            if (string.IsNullOrEmpty(value)) return value;
            if (value.Length <= maxLen) return value;
            return value.Substring(0, maxLen) + "...";
        }
    }
}
