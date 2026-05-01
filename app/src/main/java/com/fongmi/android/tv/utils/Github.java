package com.fongmi.android.tv.utils;

import android.text.TextUtils;

import com.fongmi.android.tv.BuildConfig;

public class Github {

    public static final String URL = "https://raw.githubusercontent.com/FongMi/Release/fongmi";

    private static String getBaseUrl() {
        return TextUtils.isEmpty(BuildConfig.UPDATE_BASE_URL) ? URL : BuildConfig.UPDATE_BASE_URL;
    }

    private static String getUrl(String name) {
        return getBaseUrl() + "/apk/" + name;
    }

    public static String getJson(String name) {
        return getUrl(name + ".json");
    }

    public static String getApk(String name) {
        return getUrl(name + ".apk");
    }
}
