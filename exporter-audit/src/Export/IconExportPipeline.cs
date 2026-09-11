using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using Mafi;
using Mafi.Core.Prototypes;
using Mafi.Unity;

namespace CoI_Exporter {
    internal static class IconExportPipeline {
        internal sealed class IconExportSummary {
            public int BuildingCandidates;
            public int BuildingSkippedNoRecipe;
            public int ProductsConsidered;
            public int BuildingsConsidered;
            public int ProductsExported;
            public int BuildingsExported;
            public int ProductsPngExported;
            public int BuildingsPngExported;
            public int ProductsJpgExported;
            public int BuildingsJpgExported;
            public int MissingIconPath;
            public int MissingAsset;
            public int EncodeFailures;
            public int Failures;
            public List<string> ProductDebugLines = new List<string>();
            public List<string> BuildingDebugLines = new List<string>();

            public int TotalExported => ProductsExported + BuildingsExported;
        }

        public static IconExportSummary ExportIcons(ProtosDb db, DependencyResolver resolver, string outputDir) {
            var summary = new IconExportSummary();
            AssetsDb? assetsDb = TryResolveAssetsDb(resolver);
            if (assetsDb == null) return summary;

            string iconsRoot = Path.Combine(outputDir, "icons");
            string productsDir = Path.Combine(iconsRoot, "products");
            string buildingsDir = Path.Combine(iconsRoot, "buildings");
            Directory.CreateDirectory(productsDir);
            Directory.CreateDirectory(buildingsDir);

            foreach (var product in db.All<Proto>().Where(p => p.GetType().Name.Contains("ProductProto"))) {
                summary.ProductsConsidered++;
                if (TryExportProtoIcon(product, assetsDb, productsDir, out string? format, out string? failureReason, out string? debugLine)) {
                    summary.ProductsExported++;
                    if (format == "png") summary.ProductsPngExported++;
                    if (format == "jpg") summary.ProductsJpgExported++;
                }
                else {
                    summary.Failures++;
                    AccumulateFailure(summary, failureReason);
                }
                AppendDebugLine(summary.ProductDebugLines, debugLine, 50);
            }

            foreach (var building in db.All<Proto>().Where(ProtoSelection.IsBuildingProto)) {
                summary.BuildingCandidates++;
                bool hasRecipe = ProtoSelection.HasRecipeProto(building);
                if (!hasRecipe) {
                    summary.BuildingSkippedNoRecipe++;
                    AppendDebugLine(summary.BuildingDebugLines, DescribeBuildingCandidate(building, false, null, "skipped_no_recipe"), 100);
                    continue;
                }

                summary.BuildingsConsidered++;
                if (TryExportProtoIcon(building, assetsDb, buildingsDir, out string? format, out string? failureReason, out string? debugLine)) {
                    summary.BuildingsExported++;
                    if (format == "png") summary.BuildingsPngExported++;
                    if (format == "jpg") summary.BuildingsJpgExported++;
                }
                else {
                    summary.Failures++;
                    AccumulateFailure(summary, failureReason);
                }
                AppendDebugLine(summary.BuildingDebugLines, debugLine, 100);
            }

            return summary;
        }

        private static AssetsDb? TryResolveAssetsDb(DependencyResolver resolver) {
            try {
                return (AssetsDb)resolver.Resolve(typeof(AssetsDb));
            }
            catch {
                return null;
            }
        }

        private static bool TryExportProtoIcon(Proto proto, AssetsDb assetsDb, string outputDir, out string? format, out string? failureReason, out string? debugLine) {
            format = null;
            failureReason = null;
            debugLine = null;
            try {
                var iconPathInfo = TryGetIconPath(proto);
                string? iconPath = iconPathInfo.Path;
                if (string.IsNullOrWhiteSpace(iconPath)) {
                    failureReason = "missing_icon_path";
                    debugLine = DescribeProto(proto, iconPathInfo, failureReason);
                    return false;
                }

                if (TryWriteIconFile(proto, assetsDb, iconPath!, outputDir, "png")) {
                    format = "png";
                    debugLine = DescribeProto(proto, iconPathInfo, "exported_png");
                    return true;
                }

                if (TryWriteIconFile(proto, assetsDb, iconPath!, outputDir, "jpg")) {
                    format = "jpg";
                    debugLine = DescribeProto(proto, iconPathInfo, "exported_jpg");
                    return true;
                }

                failureReason = "encode_failed";
                debugLine = DescribeProto(proto, iconPathInfo, failureReason);
                return false;
            }
            catch {
                failureReason = "asset_lookup_failed";
                debugLine = DescribeProto(proto, null, failureReason);
                return false;
            }
        }

        private static bool TryWriteIconFile(Proto proto, AssetsDb assetsDb, string iconPath, string outputDir, string preferredFormat) {
            byte[]? bytes = TryLoadImageBytes(assetsDb, iconPath, preferredFormat);
            if (bytes == null || bytes.Length == 0) return false;

            string fileName = ProtoSelection.NormalizeId(proto.Id.ToString()) + "." + preferredFormat;
            File.WriteAllBytes(Path.Combine(outputDir, fileName), bytes);
            return true;
        }

        private static void AppendDebugLine(List<string> lines, string? debugLine, int limit) {
            if (string.IsNullOrWhiteSpace(debugLine)) return;
            if (lines.Count >= limit) return;
            lines.Add(debugLine);
        }

        private static void AccumulateFailure(IconExportSummary summary, string? failureReason) {
            switch (failureReason) {
                case "missing_icon_path":
                    summary.MissingIconPath++;
                    break;
                case "encode_failed":
                    summary.EncodeFailures++;
                    break;
                case "asset_lookup_failed":
                default:
                    summary.MissingAsset++;
                    break;
            }
        }

        private sealed class IconPathInfo {
            public string? Path;
            public string? SourceContainer;
            public string? SourceMember;
        }

        private static IconPathInfo TryGetIconPath(Proto proto) {
            var info = new IconPathInfo();

            foreach (string containerMember in new[] { "Graphics", "Gfx" }) {
                object? graphics = ProtoSelection.GetMemberValue(proto, containerMember);
                if (graphics == null) continue;

                TryInitializeGfx(graphics, proto);

                foreach (var memberName in new[] { "IconPath", "SideViewIconPath", "WorldMapIconPath", "MapEditorIconPath" }) {
                    string? path = TryGetStringMember(graphics, memberName);
                    if (!string.IsNullOrWhiteSpace(path) && !string.Equals(path, "None", StringComparison.OrdinalIgnoreCase)) {
                        info.Path = path;
                        info.SourceContainer = containerMember;
                        info.SourceMember = memberName;
                        return info;
                    }
                }
            }

            foreach (var memberName in new[] { "IconPath", "SideViewIconPath", "WorldMapIconPath", "MapEditorIconPath" }) {
                string? path = TryGetStringMember(proto, memberName);
                if (!string.IsNullOrWhiteSpace(path) && !string.Equals(path, "None", StringComparison.OrdinalIgnoreCase)) {
                    info.Path = path;
                    info.SourceContainer = "proto";
                    info.SourceMember = memberName;
                    return info;
                }
            }

            return info;
        }

        private static string? TryGetStringMember(object obj, string memberName) {
            try {
                object? value = ProtoSelection.GetMemberValue(obj, memberName);
                return value == null ? null : ProtoSelection.ValueToString(value);
            }
            catch {
                return null;
            }
        }

        private static void TryInitializeGfx(object gfx, Proto proto) {
            try {
                MethodInfo? method = gfx.GetType().GetMethods(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance)
                    .FirstOrDefault(m =>
                        m.Name == "Initialize" &&
                        m.GetParameters().Length == 1 &&
                        m.GetParameters()[0].ParameterType.IsAssignableFrom(proto.GetType()));
                if (method == null) return;
                method.Invoke(gfx, new object?[] { proto });
            }
            catch {
                // Initialization is best-effort. If the proto is already initialized or the shape differs,
                // we fall back to the existing members.
            }
        }

        private static byte[]? TryLoadImageBytes(AssetsDb assetsDb, string iconPath, string preferredFormat) {
            object? sprite = InvokeSharedSprite(assetsDb, iconPath);
            if (sprite != null) {
                byte[]? spriteBytes = TryEncodeTextureFromSprite(sprite, preferredFormat);
                if (spriteBytes != null && spriteBytes.Length > 0) return spriteBytes;
            }

            object? texture = InvokeSharedTexture(assetsDb, iconPath);
            if (texture != null) {
                byte[]? textureBytes = TryEncodeTexture(texture, preferredFormat);
                if (textureBytes != null && textureBytes.Length > 0) return textureBytes;
            }

            if (sprite != null) {
                object? spriteTexture = ProtoSelection.GetMemberValue(sprite, "texture")
                    ?? ProtoSelection.GetMemberValue(sprite, "Texture");
                if (spriteTexture != null) {
                    return TryEncodeTexture(spriteTexture, preferredFormat);
                }
            }

            return null;
        }

        private static object? InvokeSharedSprite(AssetsDb assetsDb, string iconPath) {
            try {
                var method = typeof(AssetsDb).GetMethods(BindingFlags.Public | BindingFlags.Instance)
                    .FirstOrDefault(m => m.Name == "GetSharedSprite" && m.GetParameters().Length == 2);
                if (method == null) return null;
                return method.Invoke(assetsDb, new object?[] { iconPath, null });
            }
            catch {
                return null;
            }
        }

        private static object? InvokeSharedTexture(AssetsDb assetsDb, string iconPath) {
            try {
                var method = typeof(AssetsDb).GetMethod("GetSharedTexture", BindingFlags.Public | BindingFlags.Instance);
                if (method == null) return null;
                return method.Invoke(assetsDb, new object?[] { iconPath });
            }
            catch {
                return null;
            }
        }

        private static byte[]? TryEncodeTextureFromSprite(object sprite, string preferredFormat) {
            object? texture = ProtoSelection.GetMemberValue(sprite, "texture")
                ?? ProtoSelection.GetMemberValue(sprite, "Texture");
            if (texture == null) return null;
            return TryEncodeTexture(texture, preferredFormat);
        }

        private static byte[]? TryEncodeTexture(object texture, string preferredFormat) {
            try {
                if (string.Equals(preferredFormat, "jpg", StringComparison.OrdinalIgnoreCase)) {
                    byte[]? jpg = InvokeImageConversion(texture, "EncodeToJPG", 90);
                    if (jpg != null && jpg.Length > 0) return jpg;
                }

                byte[]? png = InvokeImageConversion(texture, "EncodeToPNG");
                if (png != null && png.Length > 0) return png;

                if (!string.Equals(preferredFormat, "jpg", StringComparison.OrdinalIgnoreCase)) {
                    byte[]? jpg = InvokeImageConversion(texture, "EncodeToJPG", 90);
                    if (jpg != null && jpg.Length > 0) return jpg;
                }

                var instanceMethod = texture.GetType().GetMethod("EncodeToPNG", BindingFlags.Public | BindingFlags.Instance);
                if (instanceMethod != null) {
                    return instanceMethod.Invoke(texture, null) as byte[];
                }

                byte[]? readableCopy = TryEncodeViaReadableCopy(texture, preferredFormat);
                if (readableCopy != null && readableCopy.Length > 0) return readableCopy;
            }
            catch {
                return null;
            }

            return null;
        }

        private static byte[]? TryEncodeViaReadableCopy(object texture, string preferredFormat) {
            try {
                int width = GetIntProperty(texture, "width");
                int height = GetIntProperty(texture, "height");
                if (width <= 0 || height <= 0) return null;

                Type? graphicsType = FindUnityType("UnityEngine.Graphics");
                Type? renderTextureType = FindUnityType("UnityEngine.RenderTexture");
                Type? texture2DType = FindUnityType("UnityEngine.Texture2D");
                Type? textureFormatType = FindUnityType("UnityEngine.TextureFormat");
                Type? rectType = FindUnityType("UnityEngine.Rect");
                if (graphicsType == null || renderTextureType == null || texture2DType == null || textureFormatType == null || rectType == null) return null;

                object? renderTexture = InvokeStaticMethodByName(renderTextureType, "GetTemporary", new object?[] { width, height, 0 });
                if (renderTexture == null) return null;

                object? previousActive = TryGetStaticProperty(renderTextureType, "active");
                try {
                    // Many building icons are backed by textures that are visible but not directly encodable.
                    // Blit them to a temporary readable texture first, then export from that copy.
                    InvokeStaticMethodByName(graphicsType, "Blit", new object?[] { texture, renderTexture });
                    TrySetStaticProperty(renderTextureType, "active", renderTexture);

                    object textureFormat = Enum.Parse(textureFormatType, "RGBA32");
                    object? readableTexture = Activator.CreateInstance(texture2DType, new object?[] { width, height, textureFormat, false });
                    if (readableTexture == null) return null;

                    object sourceRect = Activator.CreateInstance(rectType, new object?[] { 0f, 0f, (float)width, (float)height })!;
                    MethodInfo? readPixels = texture2DType.GetMethods(BindingFlags.Public | BindingFlags.Instance)
                        .FirstOrDefault(m => m.Name == "ReadPixels" && m.GetParameters().Length == 3);
                    if (readPixels == null) return null;
                    readPixels.Invoke(readableTexture, new object?[] { sourceRect, 0, 0 });

                    MethodInfo? apply = texture2DType.GetMethods(BindingFlags.Public | BindingFlags.Instance)
                        .FirstOrDefault(m => m.Name == "Apply" && m.GetParameters().Length == 0);
                    apply?.Invoke(readableTexture, null);

                    return TryEncodeTextureFromReadableTexture(readableTexture, preferredFormat);
                }
                finally {
                    if (previousActive != null) {
                        TrySetStaticProperty(renderTextureType, "active", previousActive);
                    }

                    InvokeStaticMethodByName(renderTextureType, "ReleaseTemporary", new object?[] { renderTexture });
                }
            }
            catch {
                return null;
            }
        }

        private static byte[]? TryEncodeTextureFromReadableTexture(object texture2D, string preferredFormat) {
            byte[]? jpg = null;
            if (string.Equals(preferredFormat, "jpg", StringComparison.OrdinalIgnoreCase)) {
                jpg = InvokeImageConversion(texture2D, "EncodeToJPG", 90);
                if (jpg != null && jpg.Length > 0) return jpg;
            }

            byte[]? png = InvokeImageConversion(texture2D, "EncodeToPNG");
            if (png != null && png.Length > 0) return png;

            if (!string.Equals(preferredFormat, "jpg", StringComparison.OrdinalIgnoreCase)) {
                jpg = InvokeImageConversion(texture2D, "EncodeToJPG", 90);
                if (jpg != null && jpg.Length > 0) return jpg;
            }

            return null;
        }

        private static int GetIntProperty(object obj, string name) {
            try {
                object? value = ProtoSelection.GetMemberValue(obj, name);
                if (value is int i) return i;
                if (value is uint ui) return (int)ui;
                if (value is short s) return s;
                if (value is ushort us) return us;
                return int.TryParse(ProtoSelection.ValueToString(value ?? ""), out int parsed) ? parsed : 0;
            }
            catch {
                return 0;
            }
        }

        private static Type? FindUnityType(string fullName) {
            return AppDomain.CurrentDomain.GetAssemblies()
                .Select(a => a.GetType(fullName))
                .FirstOrDefault(t => t != null);
        }

        private static object? InvokeStaticMethodByName(Type type, string methodName, object?[] args) {
            try {
                MethodInfo? method = type.GetMethods(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static)
                    .FirstOrDefault(m => m.Name == methodName && m.GetParameters().Length == args.Length);
                return method?.Invoke(null, args);
            }
            catch {
                return null;
            }
        }

        private static object? TryGetStaticProperty(Type type, string propertyName) {
            try {
                PropertyInfo? property = type.GetProperty(propertyName, BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static);
                return property?.GetValue(null);
            }
            catch {
                return null;
            }
        }

        private static void TrySetStaticProperty(Type type, string propertyName, object value) {
            try {
                PropertyInfo? property = type.GetProperty(propertyName, BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static);
                property?.SetValue(null, value);
            }
            catch {
            }
        }

        private static byte[]? InvokeImageConversion(object texture, string methodName, int? quality = null) {
            try {
                Type? imageConversionType = Type.GetType("UnityEngine.ImageConversion, UnityEngine.ImageConversionModule");
                if (imageConversionType == null) {
                    imageConversionType = AppDomain.CurrentDomain.GetAssemblies()
                        .Select(a => a.GetType("UnityEngine.ImageConversion"))
                        .FirstOrDefault(t => t != null);
                }

                if (imageConversionType == null) return null;

                MethodInfo? method = null;
                if (quality.HasValue) {
                    method = imageConversionType.GetMethods(BindingFlags.Public | BindingFlags.Static)
                        .FirstOrDefault(m => m.Name == methodName && m.GetParameters().Length == 2);
                }
                else {
                    method = imageConversionType.GetMethods(BindingFlags.Public | BindingFlags.Static)
                        .FirstOrDefault(m => m.Name == methodName && m.GetParameters().Length == 1);
                }

                if (method == null) return null;

                object? result = quality.HasValue
                    ? method.Invoke(null, new object?[] { texture, quality.Value })
                    : method.Invoke(null, new object?[] { texture });
                return result as byte[];
            }
            catch {
                return null;
            }
        }

        private static string DescribeBuildingCandidate(Proto proto, bool hasRecipe, IconPathInfo? iconPathInfo, string result) {
            return DescribeProto(proto, iconPathInfo, result) + " recipe=" + hasRecipe.ToString().ToLowerInvariant();
        }

        private static string DescribeProto(Proto proto, IconPathInfo? iconPathInfo, string result) {
            string iconPath = iconPathInfo?.Path ?? "";
            string source = iconPathInfo == null
                ? ""
                : (iconPathInfo.SourceContainer ?? "") + "." + (iconPathInfo.SourceMember ?? "");

            return string.Join(
                " ",
                new[] {
                    "icon",
                    "id=" + ProtoSelection.NormalizeId(proto.Id.ToString()),
                    "type=" + proto.GetType().FullName,
                    "source=" + source,
                    "path=" + iconPath,
                    "result=" + result
                }.Where(s => !string.IsNullOrWhiteSpace(s))
            );
        }
    }
}
