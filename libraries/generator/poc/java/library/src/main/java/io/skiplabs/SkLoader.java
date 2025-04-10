package io.skiplabs;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.channels.Channels;
import java.nio.channels.FileChannel;
import java.nio.channels.ReadableByteChannel;

public class SkLoader {

    public static void load(String name) {
        try {
            try {
                System.loadLibrary(name);
            } catch (UnsatisfiedLinkError e) {
                String filename = System.mapLibraryName(name);
                int pos = filename.lastIndexOf('.');
                File file = File.createTempFile(filename.substring(0, pos), filename.substring(pos));
                file.deleteOnExit();
                try (final ReadableByteChannel src = Channels.newChannel(Library.class.getClassLoader().getResourceAsStream(filename)); final FileChannel dst = new FileOutputStream(file).getChannel()) {
                    dst.transferFrom(src, 0, Long.MAX_VALUE);

                }
                System.load(file.getAbsolutePath());
            }
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }
}
