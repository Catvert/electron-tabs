with import <nixpkgs> {};

mkShell {
    nativeBuildInputs = [
        nodejs-18_x
        yarn
        electron_30
        wineWowPackages.stable
    ];

 ELECTRON_OVERRIDE_DIST_PATH = "${electron_30}/bin/";
}
