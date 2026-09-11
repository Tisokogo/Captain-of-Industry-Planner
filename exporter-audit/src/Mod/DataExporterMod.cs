using System;
using Mafi;
using Mafi.Core;
using Mafi.Core.Game;
using Mafi.Core.Mods;
using Mafi.Core.Prototypes;
using Mafi.Collections;

namespace CoI_Exporter {
    public class DataExporterMod : IMod {
        private readonly ModManifest m_manifest;

        public DataExporterMod(ModManifest manifest) {
            m_manifest = manifest;
        }

        public string Name => m_manifest.Id;
        public int Version => ParseMajorVersion(m_manifest.Version.ToString());
        public bool IsUiOnly => false;

        public ModManifest Manifest => m_manifest;

        // v0.8.x: JsonConfig is concrete, ModConfig is Option<IConfig>
        public ModJsonConfig JsonConfig => new ModJsonConfig(this);
        public Option<IConfig> ModConfig => Option<IConfig>.None;

        public void RegisterDependencies(DependencyResolverBuilder builder, ProtosDb protosDb, bool wasLoaded) { }

        public void EarlyInit(DependencyResolver resolver) { }

        public void Initialize(DependencyResolver resolver, bool wasLoaded) {
            var db = (ProtosDb)resolver.Resolve(typeof(ProtosDb));
            ExportPipeline.ExportNow(db, resolver);
        }

        public void RegisterPrototypes(ProtoRegistrator registrator) { }

        // Using 'object' for worldBuilder to avoid namespace issues with Mafi.Unity
        public void RegisterWorld(object worldBuilder, ProtosDb protosDb) { }

        // The 'Dict' type lives in the root 'Mafi' namespace,
        // but the compiler needs to see it clearly.
        public void MigrateJsonConfig(VersionSlim oldVersion, Dict<string, object> dict) { }

        private static int ParseMajorVersion(string version) {
            if (string.IsNullOrEmpty(version)) return 1;
            int dot = version.IndexOf('.');
            string major = dot >= 0 ? version.Substring(0, dot) : version;
            if (int.TryParse(major, out int result)) return result;
            return 1;
        }

        public void Dispose() { }
    }
}
