using System;
using System.Collections.Generic;
using System.Linq;
using Mafi.Core.Prototypes;

namespace CoI_Exporter {
    internal static class ProtoBuilders {
        public static Dictionary<string, List<string>> BuildRecipeToMachinesMap(List<Proto> buildingProtos) {
            var map = new Dictionary<string, List<string>>();

            foreach (var building in buildingProtos) {
                object? recipeLike = ProtoSelection.GetMemberValue(building, "Recipe")
                    ?? ProtoSelection.GetMemberValue(building, "Recipes");
                if (recipeLike == null) continue;

                foreach (var recipeProto in ProtoSelection.ExtractRecipeProtos(recipeLike)) {
                    string key = recipeProto.Id.ToString();
                    if (!map.TryGetValue(key, out var list)) {
                        list = new List<string>();
                        map[key] = list;
                    }

                    string machineId = ProtoSelection.NormalizeId(building.Id.ToString());
                    if (!list.Contains(machineId)) list.Add(machineId);
                }
            }

            return map;
        }

        public static Dictionary<string, object?> BuildProduct(Proto proto) {
            object? storable = ProtoSelection.GetMemberValue(proto, "IsStorable");
            object? radioactivity = ProtoSelection.GetMemberValue(proto, "Radioactivity");
            object? trash = ProtoSelection.GetMemberValue(proto, "IsWaste");

            return new Dictionary<string, object?> {
                { "type", "products" },
                { "name", proto.Strings.Name.ToString() },
                { "id", ProtoSelection.NormalizeId(proto.Id.ToString()) },
                { "state", ProtoSelection.NormalizeStateFromProto(proto) },
                { "is_storable", storable ?? false },
                { "radioactivity", ProtoSelection.NormalizeNumericScalar(radioactivity) ?? 0 },
                { "is_trash", trash ?? false }
            };
        }

        public static Dictionary<string, object?> BuildRecipe(
            Proto proto,
            Dictionary<string, List<string>> recipeToMachines
        ) {
            var dict = new Dictionary<string, object?> {
                { "id", ProtoSelection.NormalizeId(proto.Id.ToString()) },
                { "name", proto.Strings.Name.ToString() },
                { "machine", recipeToMachines.TryGetValue(proto.Id.ToString(), out var machineIds) ? machineIds : new List<string>() }
            };

            object? duration = ProtoSelection.GetMemberValue(proto, "Duration") ?? ProtoSelection.GetMemberValue(proto, "Time");
            if (duration != null) dict["duration"] = ProtoSelection.NormalizeNumericScalar(duration) ?? duration.ToString();

            object? inputs = ProtoSelection.GetMemberValue(proto, "AllUserVisibleInputs")
                ?? ProtoSelection.GetMemberValue(proto, "AllInputs")
                ?? ProtoSelection.GetMemberValue(proto, "Inputs")
                ?? ProtoSelection.GetMemberValue(proto, "Input");
            object? outputs = ProtoSelection.GetMemberValue(proto, "AllUserVisibleOutputs")
                ?? ProtoSelection.GetMemberValue(proto, "AllOutputs")
                ?? ProtoSelection.GetMemberValue(proto, "Outputs")
                ?? ProtoSelection.GetMemberValue(proto, "Output");

            dict["inputs"] = ExtractIoList(inputs);
            dict["outputs"] = ExtractIoList(outputs);

            return dict;
        }

        public static Dictionary<string, object?> BuildBuilding(Proto proto) {
            var dict = new Dictionary<string, object?> {
                { "type", "building" },
                { "name", proto.Strings.Name.ToString() },
                { "id", ProtoSelection.NormalizeId(proto.Id.ToString()) }
            };

            object? costs = ProtoSelection.GetMemberValue(proto, "Costs");
            object? constructionCost = ProtoSelection.GetMemberValue(costs, "BaseConstructionCost")
                ?? ProtoSelection.GetMemberValue(proto, "BaseConstructionCost");
            object? maintenance = ProtoSelection.GetMemberValue(costs, "Maintenance")
                ?? ProtoSelection.GetMemberValue(proto, "MaintenanceCost")
                ?? ProtoSelection.GetMemberValue(proto, "MaintenanceCostPerPeriod")
                ?? ProtoSelection.GetMemberValue(proto, "UpkeepCost")
                ?? ProtoSelection.GetMemberValue(proto, "Upkeep")
                ?? ProtoSelection.GetMemberValue(proto, "Maintenance");

            object? power = ProtoSelection.GetMemberValue(proto, "PowerConsumption")
                ?? ProtoSelection.GetMemberValue(proto, "ElectricityConsumed")
                ?? ProtoSelection.GetMemberValue(proto, "ElectricityConsumption")
                ?? ProtoSelection.GetMemberValue(proto, "Power")
                ?? ProtoSelection.GetMemberValue(proto, "PowerCost");

            object? workers = ProtoSelection.GetMemberValue(costs, "Workers")
                ?? ProtoSelection.GetMemberValue(proto, "Workers")
                ?? ProtoSelection.GetMemberValue(proto, "WorkersRequired")
                ?? ProtoSelection.GetMemberValue(proto, "WorkerCount")
                ?? ProtoSelection.GetMemberValue(proto, "WorkerSlots");

            object? computing = ProtoSelection.GetMemberValue(proto, "Computing")
                ?? ProtoSelection.GetMemberValue(proto, "ComputingConsumed")
                ?? ProtoSelection.GetMemberValue(proto, "ComputingCost")
                ?? ProtoSelection.GetMemberValue(proto, "ComputingPower");

            var stats = new Dictionary<string, object?>();
            if (workers != null) stats["workers"] = ProtoSelection.NormalizeNumericScalar(workers) ?? workers.ToString();
            if (power != null) stats["electricity_kw"] = ProtoSelection.NormalizeNumericScalar(power) ?? power.ToString();
            if (computing != null) stats["computing_tflops"] = ProtoSelection.NormalizeNumericScalar(computing) ?? computing.ToString();

            var maintenanceCost = BuildMaintenanceCost(maintenance);
            if (maintenanceCost != null) {
                stats["maintenance_cost"] = maintenanceCost;
            }

            dict["stats"] = stats;
            dict["construction_cost"] = BuildConstructionCost(constructionCost);
            return dict;
        }

        public static Dictionary<string, object?> BuildContract(Proto proto) {
            var dict = new Dictionary<string, object?> {
                { "type", "contract" }
            };

            object? reputationLevel = ProtoSelection.GetMemberValue(proto, "MinReputationRequired")
                ?? ProtoSelection.GetMemberValue(proto, "ReputationLevel")
                ?? ProtoSelection.GetMemberValue(proto, "Reputation");
            dict["reputation_level"] = ProtoSelection.NormalizeNumericScalar(reputationLevel) ?? 0;

            object? boughtProduct = ProtoSelection.GetMemberValue(proto, "ProductToBuy");
            object? paidProduct = ProtoSelection.GetMemberValue(proto, "ProductToPayWith");
            object? quantityToBuy = ProtoSelection.GetMemberValue(proto, "QuantityToBuy");
            object? quantityToPay = ProtoSelection.GetMemberValue(proto, "QuantityToPayWith");

            var inputList = new List<Dictionary<string, object?>>();
            var outputList = new List<Dictionary<string, object?>>();

            AppendProductQuantity(inputList, paidProduct, quantityToPay);
            AppendProductQuantity(outputList, boughtProduct, quantityToBuy);

            if (inputList.Count == 0 && outputList.Count == 0) {
                ProtoSelection.InferContractIoFromId(proto.Id.ToString(), out inputList, out outputList);
            }

            dict["inputs"] = inputList;
            dict["outputs"] = outputList;
            return dict;
        }

        public static Dictionary<string, object?> BuildResearch(Proto proto) {
            var record = new Dictionary<string, object?> {
                { "id", ProtoSelection.NormalizeId(proto.Id.ToString()) },
                { "name", proto.Strings.Name.ToString() },
                { "tier", FindNumeric(proto, "Tier", "ResearchTier", "Level") },
                { "parent_ids", ExtractProtoIds(proto, "ParentResearch", "ParentResearches", "Parents", "Prerequisites") },
                { "unlocks", ExtractUnlocks(proto) }
            };
            return record;
        }

        private static object? FindNumeric(Proto proto, params string[] names) {
            foreach (string name in names) {
                object? value = ProtoSelection.NormalizeNumericScalar(ProtoSelection.GetMemberValue(proto, name));
                if (value != null) return value;
            }
            return null;
        }

        private static List<string> ExtractProtoIds(Proto proto, params string[] names) {
            var ids = new List<string>();
            foreach (string name in names) {
                foreach (object? value in ProtoSelection.Enumerate(ProtoSelection.GetMemberValue(proto, name))) {
                    var referenced = value as Proto;
                    if (referenced != null) ids.Add(ProtoSelection.NormalizeId(referenced.Id.ToString()));
                }
                if (ids.Count > 0) break;
            }
            return ids.Distinct().ToList();
        }

        private static List<Dictionary<string, object?>> ExtractUnlocks(Proto proto) {
            var unlocks = new List<Dictionary<string, object?>>();
            string[] names = { "Unlocks", "Unlock", "UnlockedProtos", "Unlockables" };
            foreach (string name in names) {
                foreach (object? value in ProtoSelection.Enumerate(ProtoSelection.GetMemberValue(proto, name))) {
                    var referenced = value as Proto;
                    if (referenced == null) continue;
                    string typeName = referenced.GetType().Name;
                    string type = typeName.Contains("Recipe") ? "recipe"
                        : typeName.Contains("Product") ? "product"
                        : typeName.Contains("Building") || typeName.Contains("Machine") ? "building"
                        : "other";
                    unlocks.Add(new Dictionary<string, object?> {
                        { "type", type },
                        { "id", ProtoSelection.NormalizeId(referenced.Id.ToString()) },
                        { "name", referenced.Strings.Name.ToString() }
                    });
                }
                if (unlocks.Count > 0) break;
            }
            return unlocks
                .GroupBy(item => $"{item["type"]}:{item["id"]}")
                .Select(group => group.First())
                .ToList();
        }

        private static List<Dictionary<string, object?>> ExtractIoList(object? io) {
            var list = new List<Dictionary<string, object?>>();
            if (io == null) return list;

            if (ProtoSelection.IsEntityCosts(io)) {
                object? innerCosts = ProtoSelection.GetMemberValue(io, "Costs")
                    ?? ProtoSelection.GetMemberValue(io, "Items")
                    ?? ProtoSelection.GetMemberValue(io, "Entries")
                    ?? ProtoSelection.GetMemberValue(io, "Values");
                if (innerCosts is System.Collections.IEnumerable) io = innerCosts;
            }

            if (!(io is System.Collections.IEnumerable) || io is string) {
                object? inner = ProtoSelection.GetMemberValue(io, "Costs")
                    ?? ProtoSelection.GetMemberValue(io, "Items")
                    ?? ProtoSelection.GetMemberValue(io, "Entries")
                    ?? ProtoSelection.GetMemberValue(io, "Values");
                if (inner is System.Collections.IEnumerable) io = inner;
            }

            foreach (var item in ProtoSelection.Enumerate(io)) {
                if (item == null) continue;
                if (ProtoSelection.IsEntityCosts(item)) {
                    foreach (var nested in ExtractIoList(item)) list.Add(nested);
                    continue;
                }

                var entry = new Dictionary<string, object?>();

                object? quantityLike = ProtoSelection.GetMemberValue(item, "ProductQuantity")
                    ?? ProtoSelection.GetMemberValue(item, "RecipeProductQuantity")
                    ?? ProtoSelection.GetMemberValue(item, "SourceProductQuantity");

                var product = ProtoSelection.TryGetProto(ProtoSelection.GetMemberValue(item, "Product")
                    ?? ProtoSelection.GetMemberValue(item, "ProductProto")
                    ?? ProtoSelection.GetMemberValue(item, "Item")
                    ?? ProtoSelection.GetMemberValue(item, "ItemProto")
                    ?? ProtoSelection.GetMemberValue(item, "Resource")
                    ?? ProtoSelection.GetMemberValue(item, "Material")
                    ?? ProtoSelection.GetMemberValue(item, "MaterialProto")
                    ?? ProtoSelection.GetMemberValue(quantityLike, "Product")
                    ?? ProtoSelection.GetMemberValue(quantityLike, "ProductProto")
                    ?? ProtoSelection.GetMemberValue(quantityLike, "Item")
                    ?? ProtoSelection.GetMemberValue(quantityLike, "ItemProto"))
                    ?? ProtoSelection.TryGetProto(item);

                if (product != null) {
                    entry["product_id"] = ProtoSelection.NormalizeId(product.Id.ToString());
                }
                else {
                    string rawName = item.ToString() ?? "";
                    if (!string.IsNullOrEmpty(rawName)) entry["product_id"] = ProtoSelection.NormalizeId(rawName);
                }

                object? amount = ProtoSelection.GetMemberValue(item, "Amount")
                    ?? ProtoSelection.GetMemberValue(item, "Quantity")
                    ?? ProtoSelection.GetMemberValue(item, "Qty")
                    ?? ProtoSelection.GetMemberValue(item, "Count")
                    ?? ProtoSelection.GetMemberValue(item, "Value")
                    ?? ProtoSelection.GetMemberValue(item, "InputAmount")
                    ?? ProtoSelection.GetMemberValue(item, "OutputAmount")
                    ?? ProtoSelection.GetMemberValue(item, "Cost")
                    ?? ProtoSelection.GetMemberValue(quantityLike, "Amount")
                    ?? ProtoSelection.GetMemberValue(quantityLike, "Quantity")
                    ?? ProtoSelection.GetMemberValue(quantityLike, "Qty")
                    ?? ProtoSelection.GetMemberValue(quantityLike, "Value");

                if (amount != null) entry["amount"] = ProtoSelection.NormalizeNumericScalar(amount) ?? amount.ToString();
                list.Add(entry);
            }

            return list;
        }

        private static void AppendProductQuantity(
            List<Dictionary<string, object?>> list,
            object? productValue,
            object? quantityValue
        ) {
            var product = ProtoSelection.TryGetProto(productValue);
            if (product == null) return;

            var entry = new Dictionary<string, object?> {
                { "product_id", ProtoSelection.NormalizeId(product.Id.ToString()) }
            };

            if (quantityValue != null) {
                entry["amount"] = ProtoSelection.NormalizeNumericScalar(quantityValue) ?? quantityValue.ToString();
            }

            list.Add(entry);
        }

        private static Dictionary<string, object?>? BuildMaintenanceCost(object? maintenance) {
            if (maintenance == null) return null;

            var product = ProtoSelection.TryGetProto(ProtoSelection.GetMemberValue(maintenance, "Product")
                ?? ProtoSelection.GetMemberValue(maintenance, "ProductProto"));
            if (product == null) return null;

            object? amount = ProtoSelection.GetMemberValue(maintenance, "MaintenancePerMonth")
                ?? ProtoSelection.GetMemberValue(maintenance, "MaxMaintenancePerMonth");

            var dict = new Dictionary<string, object?> {
                { "product_id", ProtoSelection.NormalizeId(product.Id.ToString()) }
            };

            if (amount != null) {
                dict["amount"] = ProtoSelection.NormalizeNumericScalar(amount) ?? amount.ToString();
            }

            return dict;
        }

        private static List<Dictionary<string, object?>> BuildConstructionCost(object? constructionCost) {
            if (constructionCost == null) return new List<Dictionary<string, object?>>();

            object? productList = ProtoSelection.GetMemberValue(constructionCost, "Products")
                ?? ProtoSelection.GetMemberValue(constructionCost, "Items")
                ?? ProtoSelection.GetMemberValue(constructionCost, "Entries")
                ?? ProtoSelection.GetMemberValue(constructionCost, "Values");

            if (productList != null) {
                return ExtractIoList(productList);
            }

            return ExtractIoList(constructionCost);
        }
    }
}
