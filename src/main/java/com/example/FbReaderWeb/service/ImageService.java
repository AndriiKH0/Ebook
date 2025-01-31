package com.example.FbReaderWeb.service;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.util.Base64;

@Service
public class ImageService {

    @Async
    public void processAndSaveImage(String base64Data, String outputPath) {
        try {
            byte[] decodedBytes = Base64.getMimeDecoder().decode(base64Data);
            BufferedImage img = ImageIO.read(new ByteArrayInputStream(decodedBytes));
            if (img != null) {
                ImageIO.write(img, "jpg", new File(outputPath));
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
