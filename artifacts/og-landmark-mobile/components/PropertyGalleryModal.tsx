import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  ImageSourcePropType,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { propertyImages, Property } from '@/lib/properties';

export function PropertyGalleryModal({
  property,
  visible,
  initialIndex,
  onClose,
}: {
  property: Property;
  visible: boolean;
  initialIndex: number;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const listRef = useRef<FlatList<ImageSourcePropType>>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const images = propertyImages(property);

  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
    }
  }, [initialIndex, visible]);

  const moveTo = (index: number) => {
    if (index < 0 || index >= images.length) return;
    listRef.current?.scrollToIndex({ index, animated: true });
    setCurrentIndex(index);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { backgroundColor: colors.foreground }]}>
        <FlatList
          key={`${property.id}-${initialIndex}`}
          ref={listRef}
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={Math.min(initialIndex, images.length - 1)}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          keyExtractor={(_, index) => `${property.id}-gallery-${index}`}
          onMomentumScrollEnd={(event) => {
            const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
            setCurrentIndex(nextIndex);
          }}
          renderItem={({ item }) => (
            <View style={[styles.imagePage, { width, height }]}>
              <Image source={item} style={styles.fullImage} resizeMode="contain" />
            </View>
          )}
        />

        <View style={[styles.topBar, { top: insets.top + 12 }]}>
          <Text style={[styles.counter, { color: colors.primaryForeground }]}>
            {currentIndex + 1} / {images.length}
          </Text>
          <Pressable
            onPress={onClose}
            style={[styles.closeButton, { backgroundColor: colors.action, borderColor: colors.action }]}
            accessibilityLabel="Close full screen gallery"
            hitSlop={8}
          >
            <Feather name="x" size={22} color={colors.actionForeground} />
          </Pressable>
        </View>

        {currentIndex > 0 && (
          <Pressable
            onPress={() => moveTo(currentIndex - 1)}
            style={[styles.arrowButton, styles.leftArrow, { backgroundColor: colors.action, borderColor: colors.action }]}
            accessibilityLabel="View previous property image"
            hitSlop={8}
          >
            <Feather name="chevron-left" size={28} color={colors.actionForeground} />
          </Pressable>
        )}
        {currentIndex < images.length - 1 && (
          <Pressable
            onPress={() => moveTo(currentIndex + 1)}
            style={[styles.arrowButton, styles.rightArrow, { backgroundColor: colors.action, borderColor: colors.action }]}
            accessibilityLabel="View next property image"
            hitSlop={8}
          >
            <Feather name="chevron-right" size={28} color={colors.actionForeground} />
          </Pressable>
        )}

        <View style={[styles.hint, { bottom: insets.bottom + 18 }]}>
          <Feather name="move" size={14} color={colors.primaryForeground} />
          <Text style={[styles.hintText, { color: colors.primaryForeground }]}>Swipe to browse</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  imagePage: { alignItems: 'center', justifyContent: 'center' },
  fullImage: { width: '100%', height: '100%' },
  topBar: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counter: { fontFamily: 'Inter_700Bold', fontSize: 13, letterSpacing: 0.5 },
  closeButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  arrowButton: { position: 'absolute', top: '50%', marginTop: -24, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  leftArrow: { left: 14 },
  rightArrow: { right: 14 },
  hint: { position: 'absolute', alignSelf: 'center', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  hintText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
});