package com.apkinstaller;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import androidx.core.content.FileProvider;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.io.File;

public class ApkInstallerModule extends ReactContextBaseJavaModule {

    private final ReactApplicationContext reactContext;

    public ApkInstallerModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
    }

    @Override
    public String getName() {
        return "ApkInstaller";
    }

    @ReactMethod
    public void install(String filePath) {
        File apkFile = new File(filePath);
        if (!apkFile.exists()) return;

        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            Uri contentUri = FileProvider.getUriForFile(
                reactContext,
                reactContext.getPackageName() + ".provider",
                apkFile
            );
            intent.setDataAndType(contentUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } else {
            Uri fileUri = Uri.fromFile(apkFile);
            intent.setDataAndType(fileUri, "application/vnd.android.package-archive");
        }

        reactContext.startActivity(intent);
    }
}
