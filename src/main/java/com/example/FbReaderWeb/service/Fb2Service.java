package com.example.FbReaderWeb.service;
import com.example.FbReaderWeb.model.User;
import com.example.FbReaderWeb.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import com.example.FbReaderWeb.model.Ebook;
import com.example.FbReaderWeb.repository.EbookRepository;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.mozilla.universalchardet.UniversalDetector;
import java.awt.Image;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;



@Service
public class Fb2Service {

    private final EbookRepository ebookRepository;
    private final UserRepository userRepository;
    private static final Logger logger = LoggerFactory.getLogger(Fb2Service.class);
    @Autowired
    public Fb2Service(EbookRepository ebookRepository, UserRepository userRepository) {
        this.ebookRepository = ebookRepository;
        this.userRepository = userRepository;
    }




    public void extractAndSaveImagesAsync(String content, String outputDir, String bookId) {
        extractAndSaveImages(content, outputDir, bookId);
    }

    public List<Ebook> searchByTitle(String query) {
        return ebookRepository.findByTitleContainingIgnoreCase(query);
    }

    public List<Ebook> searchByAuthor(String query) {
        return ebookRepository.findByAuthorContainingIgnoreCase(query);
    }

    public List<Ebook> searchByGenre(String genre, String username) {
        return ebookRepository.findByUserAndGenreContainingIgnoreCase(username, genre);
    }

    public String processFb2File(MultipartFile file, String username) throws IOException {

        String bookId = UUID.randomUUID().toString();


        Path tempDir = Files.createTempDirectory("fb2_temp");


        String outputDir = new File("src/main/resources/static/images").getAbsolutePath() + File.separator;


        File tempFile = new File(tempDir.toString(), "temp.fb2");
        file.transferTo(tempFile);


        String charset = detectCharset(tempFile.getAbsolutePath());
        String content = readText(tempFile.getAbsolutePath(), charset);


        String title = extractTagContent(content, "<book-title>", "</book-title>");
        title = title != null ? stripTags(title) : "Unknown title";

        String author = extractAuthor(content);


        String parsedContent = parseFb2(content, outputDir, bookId);
        parsedContent = flattenTextWithTags(parsedContent);
        parsedContent = cleanHtmlTags(parsedContent);
        parsedContent = mergeBrokenText(parsedContent);

        List<String> genres = extractGenres(content);
        List<String> uniqueGenres = genres.stream().distinct().collect(Collectors.toList());


        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));

        Ebook ebook = saveEbookToDatabase(title, author, parsedContent, bookId);
        ebook.setGenres(uniqueGenres);
        ebook.setUser(user);
        ebookRepository.save(ebook);


        extractAndSaveImagesAsync(content, outputDir, bookId);


        Files.walk(tempDir).sorted(Comparator.reverseOrder()).map(Path::toFile).forEach(File::delete);

        return ebook.getId().toString();
    }

    private String parseFb2(String content, String outputDir, String bookId) {
        extractAndSaveCoverImage(content, outputDir, bookId);
        extractAndSaveImages(content, outputDir, bookId);

        String title = extractTagContent(content, "<book-title>", "</book-title>");
        title = (title != null) ? title.trim() : "No name";

        String authorTag = extractTagContent(content, "<author>", "</author>");
        String firstName = (authorTag != null) ? extractTagContent(authorTag, "<first-name>", "</first-name>") : "";
        String lastName = (authorTag != null) ? extractTagContent(authorTag, "<last-name>", "</last-name>") : "";
        String author = ((firstName != null ? firstName : "") + " " + (lastName != null ? lastName : "")).trim();
        if (author.isEmpty()) {
            author = "Unknown author";
        }

        StringBuilder result = new StringBuilder();

        result.append("<div class='cover-page'>")
                .append("<img src='/images/").append(bookId).append("_cover.jpg' alt='Cover' class='cover-image'>")
                .append("<h1 class='book-title'>").append(title).append("</h1>")
                .append("<h2 class='book-author'>").append(author).append("</h2>")
                .append("</div>");

        String body = extractTagContent(content, "<body>", "</body>");
        if (body != null) {
            body = body.replaceAll("(?i)<title>\\s*<p>(.*?)</p>\\s*</title>", "<h3 style=\"text-align: center;\">$1</h3>");


            body = body.replaceAll("<image\\s+xlink:href=\"#(.*?)\"\\s*/?>",
                    "<img src=\"/images/" + bookId + "_$1.jpg\" style=\"max-width: 100%; height: auto;\">");


            body = body.replaceAll("<image\\s+l:href=\"#(.*?)\"\\s*/>",
                    "<img src=\"/images/" + bookId + "_$1.jpg\" style=\"max-width: 100%; height: auto;\">");


            body = body.replaceAll("<image\\s+l:href=\"#(.*?)\"\\s*>",
                    "<img src=\"/images/" + bookId + "_$1.jpg\" style=\"max-width: 100%; height: auto;\">");

            body = body.replaceAll("__+", "_");

            result.append("<div class='page' id='firstPage'>").append(body).append("</div>");
        }

        return result.toString();
    }



    private Ebook saveEbookToDatabase(String title, String author, String content, String bookId) {
        Ebook ebook = new Ebook();
        ebook.setTitle(title);
        ebook.setAuthor(author);
        ebook.setContent(content);
        if (bookId != null && !bookId.isEmpty()) {
            ebook.setCoverFilename(bookId + "_cover.jpg");
        }
        return ebookRepository.save(ebook);
    }


    private String detectCharset(String filePath) {
        try (InputStream inputStream = new FileInputStream(filePath)) {
            byte[] bytes = new byte[4096];
            UniversalDetector detector = new UniversalDetector(null);
            int nread;
            while ((nread = inputStream.read(bytes)) > 0 && !detector.isDone()) {
                detector.handleData(bytes, 0, nread);
            }
            detector.dataEnd();
            return detector.getDetectedCharset();
        } catch (IOException e) {
            e.printStackTrace();
        }
        return null;
    }
    public int getTotalPages(String content, int wordsPerScreen, boolean twoPageMode) {
        List<String> pages = twoPageMode
                ? paginateTwoPageMode(content, wordsPerScreen)
                : paginateContent(content, wordsPerScreen, twoPageMode);
        return pages.size();
    }
    private String readText(String filePath, String charset) {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(new FileInputStream(filePath), charset))) {
            StringBuilder builder = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                builder.append(line).append("\n");
            }
            return builder.toString();
        } catch (IOException e) {
            e.printStackTrace();
        }
        return null;
    }


    private String flattenTextWithTags(String content) {
        return content.replaceAll("<emphasis>(.*?)</emphasis>", "<em>$1</em>");
    }
    private String cleanHtmlTags(String content) {

        content = content.replaceAll("<span>(\\s*)<span>", "<span>");
        content = content.replaceAll("</span>(\\s*)</span>", "</span>");


        content = content.replaceAll("<emphasis>(.*?)</emphasis>", "<span style=\"font-style:italic\">$1</span>");
        content = content.replaceAll("<em>(.*?)</em>", "<span style=\"font-style:italic\">$1</span>");

        return content;
    }

    private String mergeBrokenText(String content) {

        content = content.replaceAll("(</em>)(\\s*)(<em>)", "");
        content = content.replaceAll("(</span>)(\\s*)(<span>)", "");


        content = content.replaceAll("\\s+</span>", "</span>");
        content = content.replaceAll("<span>\\s+", "<span>");

        return content;
    }




    private String extractAuthor(String content) {
        String authorTag = extractTagContent(content, "<author>", "</author>");
        if (authorTag == null) return "Unknown author";

        String firstName = extractTagContent(authorTag, "<first-name>", "</first-name>");
        String lastName = extractTagContent(authorTag, "<last-name>", "</last-name>");

        firstName = firstName != null ? firstName : "";
        lastName = lastName != null ? lastName : "";

        return (firstName + " " + lastName).trim();
    }

    private String extractTagContent(String content, String startTag, String endTag) {
        int start = content.indexOf(startTag);
        if (start == -1) {
            System.err.println("Tag " + startTag + " nie znaleziono!");
            return "";
        }

        int end = content.indexOf(endTag, start + startTag.length());
        if (end == -1) {
            System.err.println("Tag " + endTag + " nie znaleziono!");
            return "";
        }


        return content.substring(start + startTag.length(), end).trim();
    }


    private String stripTags(String input) {
        return input.replaceAll("<[^>]+>", "").trim();
    }

    private void extractAndSaveCoverImage(String content, String outputDir, String bookId) {
        Pattern pattern = Pattern.compile("<binary[^>]+id=\"(.*?)\"[^>]*>(.*?)</binary>", Pattern.DOTALL);
        Matcher matcher = pattern.matcher(content);

        String coverTag = extractTagContent(content, "<coverpage>", "</coverpage>");
        if (coverTag == null) return;

        while (matcher.find()) {
            String imageId = matcher.group(1);
            String base64Data = matcher.group(2).replaceAll("\\s+", "");


            if (coverTag.contains("xlink:href=\"#" + imageId + "\"") ||
                    coverTag.contains("l:href=\"#" + imageId + "\"") ||
                    coverTag.contains("l:href=\"#cover.jpg\"")) {

                String outputPath = outputDir + bookId + "_cover.jpg";
                saveImage(base64Data, outputPath);
                break;
            }
        }
    }



    private void extractAndSaveImages(String content, String outputDir, String bookId) {

        Pattern pattern = Pattern.compile("<binary[^>]+id=\"(.*?)\"[^>]*>(.*?)</binary>", Pattern.DOTALL);
        Matcher matcher = pattern.matcher(content);


        String coverTag = extractTagContent(content, "<coverpage>", "</coverpage>");


        Set<String> imageIdsInContent = new HashSet<>();


        Pattern imagePattern = Pattern.compile("<image\\s+l:href=\"#([^\"]+)\"\\s*/?>");
        Matcher imageMatcher = imagePattern.matcher(content);


        while (imageMatcher.find()) {
            String imageId = imageMatcher.group(1);
            imageIdsInContent.add(imageId);
            System.out.println("Found image ID in text: " + imageId);
        }

        while (matcher.find()) {
            String imageId = matcher.group(1);
            String base64Data = matcher.group(2).replaceAll("\\s+", "");

            boolean isCoverImage = false;
            if (coverTag != null) {
                isCoverImage = (coverTag.contains("l:href=\"#" + imageId + "\"") ||
                        coverTag.contains("xlink:href=\"#" + imageId + "\"") ||
                        (imageId.equals("cover.jpg") && coverTag.contains("l:href=\"#cover.jpg\"")));
            }

            if (isCoverImage) {

                System.out.println("Skip the cover: " + imageId);
                continue;
            }

            boolean shouldSave = false;
            String matchedId = null;


            if (imageIdsInContent.contains(imageId)) {
                shouldSave = true;
                matchedId = imageId;
            }

            if (!shouldSave) {
                for (String contentId : imageIdsInContent) {
                    if (contentId.contains(imageId) || imageId.contains(contentId)) {
                        shouldSave = true;
                        matchedId = contentId;
                        break;
                    }
                }
            }

            if (shouldSave) {

                String idToUse = matchedId != null ? matchedId : imageId;
                String uniqueImageName = bookId + "_" + idToUse + ".jpg";
                String outputPath = outputDir + uniqueImageName;
                System.out.println("Save the image: " + outputPath);
                saveImage(base64Data, outputPath);
            } else {
                System.out.println("Skipping image (not found in content): " + imageId);
            }
        }
    }


    private void saveImage(String base64Data, String outputPath) {
        try {
            byte[] decodedBytes = Base64.getDecoder().decode(base64Data);
            BufferedImage img = ImageIO.read(new ByteArrayInputStream(decodedBytes));

            if (img != null) {

                if (!outputPath.toLowerCase().endsWith(".jpg")) {
                    outputPath += ".jpg";
                }

                File outputFile = new File(outputPath);

                outputFile.getParentFile().mkdirs();

                ImageIO.write(img, "jpg", outputFile);
                System.out.println("Image saved: " + outputPath);
            } else {
                System.err.println("Error: Failed to decode image.");
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private BufferedImage resizeImage(BufferedImage originalImage, int targetWidth, int targetHeight) {
        Image resultingImage = originalImage.getScaledInstance(targetWidth, targetHeight, Image.SCALE_SMOOTH);
        BufferedImage outputImage = new BufferedImage(targetWidth, targetHeight, BufferedImage.TYPE_INT_RGB);
        outputImage.getGraphics().drawImage(resultingImage, 0, 0, null);
        return outputImage;
    }
    private List<String> extractGenres(String content) {
        List<String> genres = new ArrayList<>();
        int start = content.indexOf("<genre>");
        while (start != -1) {
            int end = content.indexOf("</genre>", start);
            if (end != -1) {
                String genre = content.substring(start + "<genre>".length(), end).trim();
                genres.add(formatGenre(genre));
                start = content.indexOf("<genre>", end);
            } else {
                break;
            }
        }
        return genres;
    }

    private String formatGenre(String genre) {

        genre = genre.replace("_", " ");

        return Arrays.stream(genre.split(" "))
                .map(word -> word.substring(0, 1).toUpperCase() + word.substring(1).toLowerCase())
                .collect(Collectors.joining(" "));
    }

    public List<String> paginateContent(String content, int targetWordCount, boolean twoPageMode) {

        String[] words = content.split("\\s+");
        List<String> pages = new ArrayList<>();

        int currentIndex = 0;
        int totalWordsProcessed = 0;

        while (currentIndex < words.length) {

            int pageEnd = Math.min(currentIndex + targetWordCount, words.length);

            while (pageEnd < words.length &&
                    !isSentenceBoundary(words[pageEnd - 1]) &&
                    pageEnd - currentIndex < targetWordCount + 20) {
                pageEnd++;
            }

            String pageContent = String.join(" ",
                    Arrays.copyOfRange(words, currentIndex, pageEnd)
            );

            pages.add(pageContent);


            int pageWordsCount = pageContent.split("\\s+").length;

            totalWordsProcessed += pageWordsCount;


            currentIndex = pageEnd;
        }


        return pages;
    }





    private boolean isSentenceEnd(char c) {
        return c == '.' || c == '!' || c == '?' || c == '\n';
    }
    public List<String> paginateTwoPageMode(String content, int wordsPerScreen) {
        content = content.replaceAll("(?s)<div class='cover-page'>.*?</div>\\s*", "")
                .replaceAll("(?s)<div class='page' id='firstPage'>(.*?)</div>", "$1")
                .replaceAll("\\s+", " ")
                .trim();

        String[] words = content.split("\\s+");
        List<String> pages = new ArrayList<>();

        int currentIndex = 0;
        int totalWordsProcessed = 0;

        while (currentIndex < words.length) {
            int totalPageWords = wordsPerScreen;
            int leftColumnWords = totalPageWords / 2;
            int rightColumnWords = totalPageWords - leftColumnWords;


            List<Integer> leftImageIndexes = findImageIndexes(words, currentIndex, currentIndex + leftColumnWords);
            List<Integer> rightImageIndexes = findImageIndexes(words, currentIndex + leftColumnWords, currentIndex + totalPageWords);


            if (leftImageIndexes.size() > 1) {
                leftColumnWords = leftImageIndexes.get(0);
            }
            if (rightImageIndexes.size() > 1) {
                rightColumnWords = rightImageIndexes.get(0);
            }

            int leftColumnEnd = Math.min(currentIndex + leftColumnWords, words.length);


            while (leftColumnEnd < words.length &&
                    !isSentenceBoundary(words[leftColumnEnd - 1]) &&
                    leftColumnEnd - currentIndex < leftColumnWords + 10) {
                leftColumnEnd++;
            }

            int rightColumnStart = leftColumnEnd;
            int rightColumnEnd = Math.min(rightColumnStart + rightColumnWords, words.length);


            while (rightColumnEnd < words.length &&
                    !isSentenceBoundary(words[rightColumnEnd - 1]) &&
                    rightColumnEnd - rightColumnStart < rightColumnWords + 10) {
                rightColumnEnd++;
            }


            String leftColumn = String.join(" ",
                    Arrays.copyOfRange(words, currentIndex, leftColumnEnd)
            );
            String rightColumn = String.join(" ",
                    Arrays.copyOfRange(words, rightColumnStart, rightColumnEnd)
            );
            leftColumn = removeExtraImages(leftColumn);
            rightColumn = removeExtraImages(rightColumn);
            String pageHtml = "<div class='two-column'>" +
                    "<div class='column left'><p>" + leftColumn + "</p></div>" +
                    "<div class='column right'><p>" + rightColumn + "</p></div>" +
                    "</div>";

            pages.add(pageHtml);


            int leftColumnWordsCount = leftColumn.split("\\s+").length;
            int rightColumnWordsCount = rightColumn.split("\\s+").length;
            int pageWordsCount = leftColumnWordsCount + rightColumnWordsCount;


            totalWordsProcessed += pageWordsCount;


            currentIndex = rightColumnEnd;
        }


        return pages;
    }
    private String removeExtraImages(String html) {
        Pattern imgPattern = Pattern.compile("(<img\\s+[^>]*>)");
        Matcher matcher = imgPattern.matcher(html);
        StringBuffer sb = new StringBuffer();
        boolean firstFound = false;
        while (matcher.find()) {
            if (!firstFound) {
                firstFound = true;
                matcher.appendReplacement(sb, matcher.group(1));
            } else {
                matcher.appendReplacement(sb, "");
            }
        }
        matcher.appendTail(sb);
        return sb.toString();
    }

    private List<Integer> findImageIndexes(String[] words, int start, int end) {
        List<Integer> imageIndexes = new ArrayList<>();
        for (int i = start; i < end && i < words.length; i++) {
            if (words[i].contains("<img")) {
                imageIndexes.add(i - start);
            }
        }
        return imageIndexes;
    }


    private boolean isBlockIntact(String[] words, int start, int end) {
        String[] blockTags = {"<img", "<section", "</section>", "<h3", "<empty-line>"};

        for (String tag : blockTags) {
            boolean startContains = false;
            boolean endContains = false;

            for (int i = start; i < end; i++) {
                if (words[i].contains(tag)) {
                    startContains = true;
                    break;
                }
            }

            for (int i = end; i < words.length; i++) {
                if (words[i].contains(tag)) {
                    endContains = true;
                    break;
                }
            }

            if (startContains && !endContains) {
                return false;
            }
        }

        return true;
    }




    private boolean isSentenceBoundary(String word) {
        return word.endsWith(".") ||
                word.endsWith("!") ||
                word.endsWith("?") ||
                word.endsWith(";") ||
                word.endsWith(":") ||
                word.endsWith(",");
    }




    public int findPageByTextFragment(String content, String fragment, int wordsPerScreen, boolean twoPageMode) {

        String cleanFragment = fragment.replaceAll("<[^>]+>", " ")
                .replaceAll("\\s+", " ")
                .trim()
                .toLowerCase();


        if (cleanFragment.length() < 30) {
            return -1;
        }


        List<String> pages = twoPageMode
                ? paginateTwoPageMode(content, wordsPerScreen)
                : paginateContent(content, wordsPerScreen, twoPageMode);


        for (int i = 0; i < pages.size(); i++) {
            String pageContent = pages.get(i)
                    .replaceAll("<[^>]+>", " ")
                    .replaceAll("\\s+", " ")
                    .trim()
                    .toLowerCase();

            if (pageContent.contains(cleanFragment)) {
                return twoPageMode && i == 0 ? 0 : i + 1;
            }
        }


        if (cleanFragment.length() > 50) {
            String shorterFragment = cleanFragment.substring(0, Math.min(100, cleanFragment.length()));

            for (int i = 0; i < pages.size(); i++) {
                String pageContent = pages.get(i)
                        .replaceAll("<[^>]+>", " ")
                        .replaceAll("\\s+", " ")
                        .trim()
                        .toLowerCase();

                if (pageContent.contains(shorterFragment)) {
                    return twoPageMode && i == 0 ? 0 : i + 1;
                }
            }
        }


        return -1;
    }


    public int findPageByTextFragmentInRange(String content, String fragment, int wordsPerScreen,
                                             boolean twoPageMode, int targetPage, int range) {

        int exactPage = findPageByTextFragment(content, fragment, wordsPerScreen, twoPageMode);
        if (exactPage != -1) {
            return exactPage;
        }


        List<String> pages = twoPageMode
                ? paginateTwoPageMode(content, wordsPerScreen)
                : paginateContent(content, wordsPerScreen, twoPageMode);


        int startPage = Math.max(0, targetPage - range);
        int endPage = Math.min(pages.size() - 1, targetPage + range);


        String cleanFragment = fragment.replaceAll("<[^>]+>", " ")
                .replaceAll("\\s+", " ")
                .trim()
                .toLowerCase();


        for (int i = startPage; i <= endPage; i++) {
            if (i == targetPage) continue;

            String pageContent = pages.get(i)
                    .replaceAll("<[^>]+>", " ")
                    .replaceAll("\\s+", " ")
                    .trim()
                    .toLowerCase();

            if (pageContent.contains(cleanFragment)) {
                return twoPageMode && i == 0 ? 0 : i + 1;
            }
        }

        return -1;
    }


    public int countWords(String text) {
        return text.trim().isEmpty() ? 0 : text.trim().split("\\s+").length;
    }









}