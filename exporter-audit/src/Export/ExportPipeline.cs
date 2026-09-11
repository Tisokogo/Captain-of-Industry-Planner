using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Linq;
using System.Text;
using Mafi;
using Mafi.Core.Game;
using Mafi.Core.Prototypes;

namespace CoI_Exporter {
    internal static class ExportPipeline {
        public static void ExportNow(ProtosDb db, DependencyResolver resolver) {
            try {
                var buildingProtos = db.All<Proto>()
                    .Where(ProtoSelection.IsBuildingProto)
                    .Where(ProtoSelection.HasRecipeProto)
                    .ToList();

                var recipeToMachines = ProtoBuilders.BuildRecipeToMachinesMap(buildingProtos);

                var products = db.All<Proto>()
                    .Where(p => p.GetType().Name.Contains("ProductProto"))
                    .Select(ProtoBuilders.BuildProduct)
                    .ToList();

                var recipes = db.All<Proto>()
                    .Where(p => p.GetType().Name.Contains("RecipeProto"))
                    .Select(p => ProtoBuilders.BuildRecipe(p, recipeToMachines))
                    .ToList();

                var buildings = buildingProtos
                    .Select(ProtoBuilders.BuildBuilding)
                    .ToList();

                var contracts = db.All<Proto>()
                    .Where(p => p.GetType().Name.Contains("ContractProto"))
                    .Select(ProtoBuilders.BuildContract)
                    .ToList();

                var research = db.All<Proto>()
                    .Where(IsResearchProto)
                    .Select(ProtoBuilders.BuildResearch)
                    .ToList();

                object? gameDifficultyConfig = TryResolveGameDifficultyConfig(resolver);
                var gameSettings = GameSettingsBuilders.BuildGameSettings(gameDifficultyConfig);
                var iconSummary = IconExportPipeline.ExportIcons(db, resolver, GetOutputDirectory());

                string json = JsonExporter.BuildJson(products, recipes, buildings, contracts, research, gameSettings);

                string outputDir = GetOutputDirectory();
                Directory.CreateDirectory(outputDir);

                string jsonPath = Path.Combine(outputDir, "coi_database.json");
                File.WriteAllText(jsonPath, json);

                string statusPath = Path.Combine(outputDir, "coi_exporter_status.txt");
                File.WriteAllText(statusPath, "OK " + DateTime.UtcNow.ToString("u") + "\n" + jsonPath);

                string logPath = Path.Combine(outputDir, "coi_exporter_log.txt");
                File.WriteAllText(logPath, ExportDiagnostics.BuildLog(db, recipes, buildings, products, contracts, gameSettings, iconSummary));

                if (iconSummary != null && (iconSummary.ProductDebugLines.Count > 0 || iconSummary.BuildingDebugLines.Count > 0)) {
                    string iconDebugPath = Path.Combine(outputDir, "coi_icons_debug.txt");
                    var debug = new List<string>();
                    if (iconSummary.ProductDebugLines.Count > 0) {
                        debug.Add("[products]");
                        debug.AddRange(iconSummary.ProductDebugLines);
                    }
                    if (iconSummary.BuildingDebugLines.Count > 0) {
                        debug.Add("[buildings]");
                        debug.AddRange(iconSummary.BuildingDebugLines);
                    }
                    File.WriteAllText(iconDebugPath, string.Join(Environment.NewLine, debug));
                }
            }
            catch (Exception ex) {
                WriteError(ex);
            }
        }

        private static bool IsResearchProto(Proto proto) {
            string typeName = proto.GetType().Name;
            return typeName.Contains("ResearchProto")
                || typeName.Contains("ResearchNodeProto")
                || typeName.Contains("TechnologyProto");
        }

        private static object? TryResolveGameDifficultyConfig(DependencyResolver resolver) {
            try {
                return resolver.Resolve(typeof(GameDifficultyConfig));
            }
            catch {
                return null;
            }
        }

        private static void WriteError(Exception ex) {
            string outputDir = GetOutputDirectorySafe();
            try {
                Directory.CreateDirectory(outputDir);
            }
            catch {
                // Ignore directory creation issues in fallback path.
            }

            string errorPath = Path.Combine(outputDir, "coi_exporter_error.txt");
            File.WriteAllText(errorPath, ex.ToString());
        }

        private static string GetOutputDirectory() {
            string? assemblyDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            if (!string.IsNullOrEmpty(assemblyDir)) return assemblyDir;
            return GetOutputDirectorySafe();
        }

        private static string GetOutputDirectorySafe() {
            return "/tmp";
        }
    }
}
